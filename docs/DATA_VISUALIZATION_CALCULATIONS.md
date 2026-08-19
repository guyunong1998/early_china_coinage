# Data Visualization Calculations

Exact algorithms behind every map's visual encoding: how a point's **size** is calculated, how its **color** is calculated in each of the three display modes (Points, Density, Compare), and how the density heat layer's color is calculated. This is the "what number produces what pixel" reference — for the broader component architecture, see `docs/ARCHITECTURE.md`.

Every map on the site (Find Site, the database Mint Town tab, Museum Collections' Mint Town view, the homepage `CoinFilterMap`) shares this exact same math for point size and Points-view color. Density view is the one exception: Find Site, the Mint Town tab, and Museum Collections all min-max normalize their heat weight to *that view's own filtered result set* (§3.1), while the homepage teaser map (`CoinFilterMap`, no filter UI at all) uses a fixed, unscaled intensity curve instead (§3.4) — there's no filtered set to normalize against there.

Source of truth for everything below:
- `components/map/MapVisCanvas.tsx` — size (`siteSizeByQuantity`), color dispatch (`stateColor`), Compare rendering, stacking offsets
- `lib/color-scale.ts` — the ratio→color gradient, the density gradient, the categorical identity palette
- `lib/context-heatmap.ts` — how a raw match ratio is derived from finds/contexts in the first place
- `components/visualizations/MapVisualization.tsx` — `heatWeight()` and `buildDensityLayer()`, the density heat-weight function and its per-view min-max normalization; `RatioLegend`/`DensityLegend`, the legend components
- `components/map/CoinFilterMap.tsx` — `densityIntensity()`, the homepage teaser map's own fixed (non-min-maxed) density curve
- `app/maps.css` — the numeric constants (`--map-dot-qty-size-min/max`, `--heatmap-opacity`)

---

## 1. Point size — one formula, used everywhere

Size is its own channel, fully independent of color. It always reflects a point's **raw coin quantity relative to the current list's maximum**, on a **logarithmic** scale so a handful of outlier mega-sites don't crush every other point down to a single pixel.

```
siteSizeByQuantity(qty, maxQty, min, max):
    if qty <= 1 or maxQty <= 1:
        return min
    t = log(qty) / log(maxQty)
    return round(min + t * (max - min))
```

- `min`, `max` come from CSS (`--map-dot-qty-size-min: 14px`, `--map-dot-qty-size-max: 40px`), read once per restyle pass via `dotSizeRange()` — so retinting the whole site's dot sizes is a one-line CSS edit, not a code change.
- **Anchoring:** a site with exactly 1 coin sits at exactly `min` (14px), because `log(1) = 0` → `t = 0`. A site at `maxQty` sits at exactly `max` (40px).
- **Log, not linear:** a site with 10× the coins of another does *not* get a 10× bigger dot — it gets a `log(10)/log(maxQty)` fraction of the way from 14px to 40px. This is what keeps a 3,000-coin hoard site and a 200-coin site visually distinguishable from a 5-coin site without either dwarfing the map.
- `maxQty` is recomputed per render as `max(...allPoints.map(p => p.totalQty), 1)` — it's *this list's* max, so switching between "all sites" and a filtered subset re-scales sizing to whatever's currently on screen.

Two special-case overrides on top of this formula (Points view only, see §2.3):
| State | Size |
|---|---|
| `no-data` (nothing recorded there at all) | fixed `12px` (`NO_DATA_DOT_SIZE`), not quantity-scaled — there's nothing to size by |
| `unquantified` (present, but no usable coin count) | `siteSizeByQuantity(totalQty × 0.2, ...)` — sized as a conservative 20% placeholder, so it still reads as "smaller than a confirmed match" without claiming a count that doesn't exist |

Compare view uses the *identical* formula (`siteSizeByQuantity`), just with `qty` = that specific group's own quantity at that location, and `maxQty` = the max across all Compare points currently on screen (see §4.2). Density view does not size by quantity at all — see §3.

---

## 2. Point color — Points view

This is the default view. Color encodes **what share of a location's coins match the active filter** — a continuous ratio, not a fixed palette — with a few fixed-color special cases layered on top for states that aren't really "a percentage."

### 2.1 Deriving the match ratio (before any color math happens)

A site is made of **contexts** (archaeological find units), each context is made of **finds** (individual coin-issue records with a quantity). The ratio is built bottom-up:

**Per context** (`computeContextHeatState`):
```
matched = finds where find.coin_issues_id ∈ matchedIds
if matched.length == 0:            → 'absent'
if matched.length == finds.length: → 'pure'   (every find in this context matches)

matchedQty  = Σ quantity(f) for f in finds if f matches AND has a usable quantity
totalQty    = Σ quantity(f) for f in finds   if f has a usable quantity
totalQuantified = count of finds with a usable quantity

if totalQuantified == finds.length and totalQty > 0:
    ratio = min(1, matchedQty / totalQty)      → 'ratio'
else:
    → 'unquantified'   (present, but can't compute a reliable % — some find in
                         this context has no recorded quantity_total /
                         quantity_estimated / quantity_min)
```
`quantity(f)` coalesces `quantity_total → quantity_estimated → quantity_min` (first non-null wins).

**Per site**, contexts are blended (`aggregateSiteHeatState`):
```
active = contexts where kind != 'absent'
if active.length == 0: → 'no-data'

pure    = active where kind == 'pure'
ratios  = active where kind == 'ratio'

if pure.length == active.length: → 'pure'                     # every context is 100%

if ratios.length > 0 or pure.length > 0:
    matchedQty = Σ ratios[i].matchedQty
    totalQty   = Σ ratios[i].totalQty

    if totalQty > 0:
        ratio = min(1, matchedQty / totalQty)
        if pure.length > 0:
            # A pure context has no quantity of its own to add to the sum above
            # (it may have no quantity data at all), so it can't just be folded
            # into matchedQty/totalQty. Instead each pure context contributes
            # a full "100% vote", weighted equally against each ratio context's
            # own computed ratio, and the two are averaged:
            ratio = (ratio × ratios.length + 1 × pure.length) / (ratios.length + pure.length)
        → { kind: 'ratio', ratio, matchedQty, totalQty }

    # No countable mixed contexts — fall back to a context-count ratio
    elif pure.length > 0 and unquantified.length == 0: → 'pure'
    elif pure.length > 0: → { kind: 'ratio', ratio: pure.length / active.length, ... }

else: → 'unquantified'
```

Worked example of the blend: a site has one context that's a clean 40% ratio match (`ratio = 0.4`) and one context that's `'pure'` (100%, but its own coins have no recorded quantity so it can't contribute to `matchedQty`/`totalQty`). The blended site-level ratio is `(0.4 × 1 + 1 × 1) / (1 + 1) = 0.70` — not `0.4`, because the pure context's full-match status still counts as a vote even though it can't add real quantity mass.

### 2.2 Ratio → color: the gradient itself

Once a `[0, 1]` ratio exists, it's linearly interpolated (lerp'd) between two fixed RGB endpoints — **not** a canned multi-stop palette:

```
RAMP_LIGHT = (0xd9, 0xa4, 0x06)   # #d9a406 — yellow, ratio = 0
RAMP_DARK  = (0xa0, 0x15, 0x15)   # #a01515 — red,    ratio = 1

ratioToColor(ratio):
    t = clamp(ratio, 0, 1)
    r = RAMP_LIGHT.r + (RAMP_DARK.r - RAMP_LIGHT.r) × t
    g = RAMP_LIGHT.g + (RAMP_DARK.g - RAMP_LIGHT.g) × t
    b = RAMP_LIGHT.b + (RAMP_DARK.b - RAMP_LIGHT.b) × t
    return toHex(round(r), round(g), round(b))
```

So e.g. `ratio = 0.5` → `r = 217 + (160-217)×0.5 = 188.5 → round 189`, `g = 164 + (21-164)×0.5 = 92.5 → round 93`, `b = 6 + (21-6)×0.5 = 13.5 → round 14` → `#bd5d0e`, a burnt orange roughly halfway between the yellow and red endpoints.

The Points-view legend (`RatioLegend` in `MapVisualization.tsx`) renders this same function as a continuous CSS `linear-gradient(90deg, ratioToColor(0), ratioToColor(1))` bar flanked by "0%"/"100%" labels — a direct visual sample of the actual per-point interpolation, not a discrete set of swatches at fixed ratio steps (an earlier version of this legend sampled `RAMP_LEGEND_STOPS` at `ratio ∈ {0, 0.25, 0.5, 0.75, 1}` as five separate dots; that constant no longer exists).

### 2.3 Full color dispatch, including the non-ratio special cases

```
stateColor(state, opacity = 1):
    match state.kind:
        'no-filter'    → ratioToColor(1)              @ min(1, opacity × 0.75)   # unfiltered overview reads slightly softer than an actual 100% match
        'pure'         → ratioToColor(1)               @ opacity   # #a01515, full red
        'ratio' where ratio <= 0
                       → NO_DATA_COLOR                  @ NO_DATA_ALPHA   # true 0% reads as "disabled", not pale yellow
        'ratio'        → ratioToColor(ratio)             @ opacity
        'no-data'      → NO_DATA_COLOR (#5a5a5a)         @ NO_DATA_ALPHA (0.2)
        'unquantified' → PRESENT_UNQUANTIFIED_COLOR (#c05fae) @ opacity
        'single-find'  → SINGLE_FIND_COLOR (#7b3fa0)     @ opacity
```

`'single-find'` is a presentation-only override applied just before coloring (`toDisplayState`): a `'pure'` state whose site total quantity is exactly 1 is recolored purple instead of red, because "this site's one and only recorded coin matches" is a much more notable pattern than "this multi-coin site happens to be 100% one type" — the two would otherwise be visually identical solid-red dots.

`opacity` here is `pointOpacity = readHeatmapOpacity()`, which reads the CSS custom property `--heatmap-opacity` (default **0.7**) — the one opacity knob shared by Points-view dots, Compare-view dots, and the Density gradient (§3.3). `no-data` deliberately ignores it and always renders at its own fixed `NO_DATA_ALPHA = 0.2`, so "nothing recorded" reads consistently (and stays visually recessive against every other state) regardless of the opacity setting. `NO_DATA_ALPHA` must be kept in sync with `app/maps.css`'s `--map-dot-nodata-fill`, which the actual map dot reads from (the JS constant only backs the legend swatch and popup bar, which can't read a CSS custom property) — both currently `0.2`.

---

## 3. Point color — Density view

Density view replaces per-point coloring with a single blended **heat mass** (a `leaflet.heat` canvas layer). Each point contributes a scalar **intensity weight** to that layer; there is no per-point color computed in this view — color only exists as the final blended gradient. Unlike Points view, this weight is **min-max normalized against the current filtered result set** before it ever reaches `leaflet.heat` — the darkest red always represents *this view's own maximum*, not some fixed/absolute count, and the legend labels exactly what that maximum is in real coin counts.

### 3.1 Per-point raw weight

```
heatWeight(state, totalQty):
    match state.kind:
        'no-filter' →  totalQty            # unfiltered: each site's own coin total
        'pure'      →  totalQty            # every find here matches → the site's own total is the matched count
        'no-data'      →  null             # excluded — no record of the selected type/mint at all
        'unquantified' →  null             # excluded — present, but no usable count to min-max against
        'ratio'        →  state.matchedQty # only the matched portion counts toward the heat mass
```

`null`-weight and `≤ 0`-weight points are dropped before normalization — they contribute nothing to the heat layer (same "excluded" spirit as `no-data`'s fixed gray dot in Points view, just with no dot to render here at all).

### 3.2 Min-max normalization (`buildDensityLayer`)

```
DENSITY_FLOOR = 0.15   # lowest visible intensity — keeps the min-weight point a pale
                        # yellow dot instead of literally invisible (leaflet.heat treats
                        # intensity 0 as no contribution at all)

buildDensityLayer(points):
    weighted = points where weight != null and weight > 0
    if weighted.length == 0: return { latLngs: [], range: null }

    min = min(weighted weights)
    max = max(weighted weights)
    latLngs = weighted.map(p => {
        intensity = (max == min) ? 1
                    : DENSITY_FLOOR + (1 - DENSITY_FLOOR) × (p.weight - min) / (max - min)
        return [p.lat, p.lng, intensity]
    })
    return { latLngs, range: { min, max } }
```

This is the "min-maxed" heat scale: `min`/`max` are recomputed from whatever set of points is currently weighted — the full unfiltered site list when no filter is active, or just the matched subset once a type/mint filter is on — so the color ramp always stretches across *this view's own data range*, never a fixed/arbitrary curve. `range` (raw coin counts, not normalized intensities) is handed straight to the legend (`DensityLegend`), which prints it flanking the gradient bar so "what does red mean, numerically" is always answered on screen — e.g. `1 [gradient] 36000` reads as "the darkest red on this map is a 36,000-coin location, the palest yellow is a 1-coin location, both among sites currently matching the filter."

Every density-driven map (Find Site's sites, the Mint Town tab's mints, Museum Collections' Mint Town mints) builds its `points` list from `heatWeight()` and feeds it through this exact function — only what `totalQty` means per point differs (a site's coin total, a mint's importance-score-derived quantity, or a mint's ANS specimen count).

### 3.3 leaflet.heat rendering parameters

```
L.heatLayer(points, {
    radius:     32,     // px, per-point blob radius before blur
    blur:       26,     // px, gaussian blur applied on top
    maxZoom:    9,       // intensity normalization stops changing past this zoom
    max:        1,       // the ceiling a point's weight is normalized against (matches buildDensityLayer's own [DENSITY_FLOOR, 1] intensity range)
    minOpacity: 0.25,    // even the faintest area of the layer stays at least this visible
    gradient:   buildDensityGradient(readHeatmapOpacity())
})
```

### 3.4 The density color gradient

```
DENSITY_GRADIENT_STOPS = [
    (0.15, #f0d56a)   // pale yellow
    (0.40, #e39a2b)   // amber
    (0.65, #d04a1c)   // burnt orange
    (0.85, #a01515)   // red
    (1.00, #6e0c0c)   // dark red / maroon
]

buildDensityGradient(opacity):
    return { stop: hexToRgba(hex, opacity)  for each (stop, hex) in DENSITY_GRADIENT_STOPS }
```

`leaflet.heat` internally interpolates between these 5 stops based on each pixel's *blended, post-blur* intensity (not any single point's raw value) — so the final on-screen color at any pixel is a function of how many nearby high-intensity points overlap, not a 1:1 read of one point's normalized `intensity` from §3.2. `opacity` is the same shared `--heatmap-opacity` (0.7 default) as Points/Compare view, baked directly into each stop's alpha channel since `leaflet.heat` has no single "layer opacity" knob that would apply evenly across a multi-stop gradient.

Underneath the heat layer, the ordinary per-site markers are still present but rendered nearly invisible (`inDensity` branch of `applyHeatMarkerStyle`): `size = 7px`, `color = rgba(40,40,40,0.45)` (or fully `transparent` at `size = 0` for `no-data`) — just enough of a hit target to keep popups clickable, not a visible second color layer.

### 3.5 The one exception: the homepage teaser map

`CoinFilterMap.tsx` (the always-on density overlay behind the homepage's site markers) does **not** use `heatWeight`/`buildDensityLayer` — it has no filter UI, so there's no "current filtered result set" to min-max against in the first place. Instead every site's intensity comes from its own fixed log curve, independent of every other site on the map:

```
densityIntensity(qty):
    if !qty or qty <= 0: return 0.35
    return min(1, 0.35 + log10(qty + 1) / 4)
```

A 0-coin site sits at a baseline `0.35` (never fully transparent), and more coins push it up toward `1.0` at a decelerating rate. This keeps the unfiltered overview showing real texture (bigger sites glow more) without needing a legend, since there's no filtered max to label — it shares the same `radius`/`blur`/`max`/`minOpacity`/gradient parameters as §3.3, just a different intensity source feeding in.

---

## 4. Point color — Compare view

Compare view abandons the match-ratio gradient entirely: instead of "what % matches," each point is colored by **which specific selection it belongs to** (a fixed identity color, one per mint or per coin-type pick), and a location matching more than one selection is drawn as multiple stacked points rather than one blended one.

### 4.1 The categorical identity palette

```
SELECTION_COLORS = [
    #2a78d6  blue
    #008300  green
    #e87ba4  magenta
    #eda100  yellow
    #1baf7a  aqua
    #eb6834  orange
    #4a3aa7  violet
    #e34948  red
]
```
An 8-color, colorblind-validated fixed-order palette (never algorithmically generated/cycled past 8 — a 9th selection wraps via `index % 8`).

**Stable slot assignment** (so removing one selection never shifts another's color — this is the same mechanism for mint multiselect, coin-type multiselect, and Museum Collections specimen pins):
```
nextFreeSlot(usedSlots):
    slot = 0
    while slot in usedSlots: slot += 1
    return slot

on select(id):
    slot = nextFreeSlot(currently-used slots)
    slotById[id] = slot
    color = SELECTION_COLORS[slot % 8]

on deselect(id):
    delete slotById[id]     # frees that slot for the next selection to reuse
```
A slot is claimed once and kept for the lifetime of that selection; it is never reassigned based on the selection's position in a list. The coin-type multiselect additionally *reserves* a slot for the item currently being staged (built up across the level1→level5 dropdowns, before it's locked in) the moment it first becomes non-empty, and holds that reservation fixed regardless of what happens to already-committed picks elsewhere — so a pick still being edited never changes color out from under the user mid-edit.

### 4.2 Building the Compare point set

For every `(location, selection)` pair with a nonzero matched quantity:
```
for each selection S in activeSelections:
    color = colorByValue[S.key]
    for each location L where S matches with qty > 0 at L:
        emit ComparePoint {
            key:   `${L}::${S.key}`
            color: color
            qty:   matchedQty(S, L)
            size:  siteSizeByQuantity(qty, maxCompareQty, sizeMin, sizeMax)   # §1, same formula
        }

maxCompareQty = max(qty across every emitted ComparePoint, 1)
```
A location matching 2 of 3 active selections emits exactly 2 points there (not 3, not 1 blended one) — this is the literal implementation of "Compare colors each selection separately."

### 4.3 Compare point opacity — deliberately identical to Points view

```
markerColor = hexToRgba(point.color, pointOpacity)   // pointOpacity = readHeatmapOpacity(), same 0.7 default
```
Compare points use the *exact same alpha* as ordinary Points-view dots — only the dropped pin (§5) is meant to render fully solid. This keeps Compare visually consistent with Points rather than reading as a different, more emphatic layer.

### 4.4 Stacking offset (same-location points)

When 2+ points share a `groupKey` (a site code, or a mint's name), they'd otherwise render exactly on top of each other. Each is nudged along a small fixed-radius circle instead of overlapping:

```
stackOffset(index, total, radius):
    if total <= 1: return (0, 0)
    angle = 2π × index / total
    return (round(cos(angle) × radius), round(sin(angle) × radius))
```
Compare view uses `radius = 9px`. This is a **pixel offset applied to the marker icon's anchor**, not a lat/lng jitter — so the fan-out stays the same visual size at every zoom level instead of spreading apart as you zoom in.

---

## 5. Dropped pins (selections, not Compare)

Separate from all three view modes above: a user's explicit picks (a selected mint in Find Site's "by mint" mode, a selected specimen in Museum Collections' accession-number search) always render as solid teardrop pins on top of everything else, regardless of the active view mode.

- **Color:** the selection's own identity color from §4.1's slot system, rendered **fully opaque** (`dropPinHtml` sets `fill` directly, no alpha) — deliberately the one un-faded element on the map, since it represents an explicit user pick rather than a computed state.
- **Size:** fixed, not quantity-scaled — `22px × 30px` (`PIN_WIDTH × PIN_HEIGHT`), the classic map-pin silhouette.
- **Same-location stacking:** identical `stackOffset()` mechanism as §4.4, but grouped by rounded coordinate (`lat.toFixed(5),lng.toFixed(5)`, since two different selections can genuinely share one exact mint location) and a larger `radius = 12px` (pins are bigger than Compare dots, so they need more spread to stay individually clickable).

---

## 6. Quick reference

| Constant | Value | Where |
|---|---|---|
| Point size range | 14px – 40px | `--map-dot-qty-size-min/max`, `app/maps.css` |
| No-data point size | 12px, fixed | `NO_DATA_DOT_SIZE` |
| Ratio gradient, low end | `#d9a406` (yellow) | `RAMP_LIGHT` |
| Ratio gradient, high end | `#a01515` (red) | `RAMP_DARK` |
| No-data color | `#5a5a5a` @ 0.2 alpha | `NO_DATA_COLOR` / `NO_DATA_ALPHA` (kept in sync with `app/maps.css`'s `--map-dot-nodata-fill`) |
| Unquantified color | `#c05fae` | `PRESENT_UNQUANTIFIED_COLOR` |
| Single-find color | `#7b3fa0` | `SINGLE_FIND_COLOR` |
| Identity palette | 8 fixed hues | `SELECTION_COLORS` |
| Shared opacity (Points/Compare/Density) | 0.7 default | `--heatmap-opacity` |
| Density blob radius / blur | 32px / 26px | `L.heatLayer(...)` |
| Density gradient stops | 5, `#f0d56a → #6e0c0c` | `DENSITY_GRADIENT_STOPS` |
| Density min-max floor | 0.15 (lowest visible intensity after normalization) | `DENSITY_FLOOR` |
| Homepage teaser density curve | fixed, `0.35 + log10(qty+1)/4`, not min-maxed | `densityIntensity()`, `CoinFilterMap.tsx` |
| Compare stacking radius | 9px | `stackOffset()` call site |
| Pin stacking radius | 12px | `stackOffset()` call site |
| Pin size | 22px × 30px | `PIN_WIDTH` / `PIN_HEIGHT` |
