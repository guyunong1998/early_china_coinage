# Data Visualization Calculations

Exact algorithms behind every map's visual encoding: how a point's **size** is calculated, how its **color** is calculated in each of the three display modes (Points, Density, Compare), and how the density heat layer's color is calculated. This is the "what number produces what pixel" reference — for the broader component architecture, see `docs/ARCHITECTURE.md`.

Every map on the site (Find Site, the database Mint Town tab, Museum Collections' Mint Town view, the homepage `CoinFilterMap`) shares this exact same math. The only thing that differs per map is *what* is being measured (a find site's coins vs. a mint town's coins vs. an ANS specimen count) — never *how* size or color is derived from that measurement.

Source of truth for everything below:
- `components/map/MapVisCanvas.tsx` — size (`siteSizeByQuantity`), color dispatch (`stateColor`), Compare rendering, stacking offsets
- `lib/color-scale.ts` — the ratio→color gradient, the density gradient, the categorical identity palette
- `lib/context-heatmap.ts` — how a raw match ratio is derived from finds/contexts in the first place
- `components/visualizations/MapVisualization.tsx` — `heatIntensity()`, the density heat-weight function
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

So e.g. `ratio = 0.5` → `r = 217 + (160-217)×0.5 = 188.5 → round 189`, `g = 164 + (21-164)×0.5 = 92.5 → round 93`, `b = 6 + (21-6)×0.5 = 13.5 → round 14` → `#bd5d0e`, a burnt orange roughly halfway between the yellow and red endpoints. The legend's 5 fixed swatches (`RAMP_LEGEND_STOPS`) are just this same function sampled at `ratio ∈ {0, 0.25, 0.5, 0.75, 1}`.

### 2.3 Full color dispatch, including the non-ratio special cases

```
stateColor(state, opacity):
    match state.kind:
        'no-filter'    → ratioToColor(1)              @ opacity   # unfiltered = "shown as if fully matched"
        'pure'         → ratioToColor(1)               @ opacity   # #a01515, full red
        'ratio' where ratio <= 0
                       → NO_DATA_COLOR                  @ NO_DATA_ALPHA   # true 0% reads as "disabled", not pale yellow
        'ratio'        → ratioToColor(ratio)             @ opacity
        'no-data'      → NO_DATA_COLOR (#5a5a5a)         @ NO_DATA_ALPHA (0.55)
        'unquantified' → PRESENT_UNQUANTIFIED_COLOR (#9caa4a) @ opacity
        'single-find'  → SINGLE_FIND_COLOR (#7b3fa0)     @ opacity
```

`'single-find'` is a presentation-only override applied just before coloring (`toDisplayState`): a `'pure'` state whose site total quantity is exactly 1 is recolored purple instead of red, because "this site's one and only recorded coin matches" is a much more notable pattern than "this multi-coin site happens to be 100% one type" — the two would otherwise be visually identical solid-red dots.

`opacity` here is `pointOpacity = readHeatmapOpacity()`, which reads the CSS custom property `--heatmap-opacity` (default **0.7**) — the one opacity knob shared by Points-view dots, Compare-view dots, and the Density gradient (§3.3). `no-data` deliberately ignores it and always renders at its own fixed `NO_DATA_ALPHA = 0.55`, so "nothing recorded" reads consistently regardless of the opacity setting.

---

## 3. Point color — Density view

Density view replaces per-point coloring with a single blended **heat mass** (a `leaflet.heat` canvas layer). Each point contributes a scalar **intensity weight** to that layer; there is no per-point color computed in this view — color only exists as the final blended gradient.

### 3.1 Per-point intensity weight

```
heatIntensity(state, totalQty):
    match state.kind:
        'no-filter' →  totalQty <= 0  ?  0.35
                        : min(1, 0.35 + log10(totalQty + 1) / 4)
        'no-data'      →  null                    # excluded from the heat layer entirely
        'unquantified' →  0.4                      # fixed moderate weight
        'pure'         →  1                        # full weight
        'ratio'        →  max(0.08, state.ratio)   # floor so a small-but-real match stays visible
```

Points with `intensity == null` are dropped before being handed to `leaflet.heat` — they contribute nothing to the blended mass. Everything else becomes a `[lat, lng, intensity]` triple.

The `'no-filter'` branch is its own small log curve (independent of the point-size log curve in §1): a site with 0 coins sits at a baseline `0.35`, and more coins push it up toward `1.0` at a decelerating rate via `log10(totalQty + 1) / 4`. This means the *unfiltered* density view still shows real texture (bigger sites glow more) rather than a flat wash.

### 3.2 leaflet.heat rendering parameters

```
L.heatLayer(points, {
    radius:     32,     // px, per-point blob radius before blur
    blur:       26,     // px, gaussian blur applied on top
    maxZoom:    9,       // intensity normalization stops changing past this zoom
    max:        1,       // the ceiling a point's weight is normalized against (matches heatIntensity's own 0–1 range)
    minOpacity: 0.25,    // even the faintest area of the layer stays at least this visible
    gradient:   buildDensityGradient(readHeatmapOpacity())
})
```

### 3.3 The density color gradient

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

`leaflet.heat` internally interpolates between these 5 stops based on each pixel's *blended, post-blur* intensity (not any single point's raw value) — so the final on-screen color at any pixel is a function of how many nearby high-intensity points overlap, not a 1:1 read of one point's `heatIntensity()`. `opacity` is the same shared `--heatmap-opacity` (0.7 default) as Points/Compare view, baked directly into each stop's alpha channel since `leaflet.heat` has no single "layer opacity" knob that would apply evenly across a multi-stop gradient.

Underneath the heat layer, the ordinary per-site markers are still present but rendered nearly invisible (`inDensity` branch of `applyHeatMarkerStyle`): `size = 7px`, `color = rgba(40,40,40,0.45)` (or fully `transparent` at `size = 0` for `no-data`) — just enough of a hit target to keep popups clickable, not a visible second color layer.

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
| No-data color | `#5a5a5a` @ 0.55 alpha | `NO_DATA_COLOR` / `NO_DATA_ALPHA` |
| Unquantified color | `#9caa4a` | `PRESENT_UNQUANTIFIED_COLOR` |
| Single-find color | `#7b3fa0` | `SINGLE_FIND_COLOR` |
| Identity palette | 8 fixed hues | `SELECTION_COLORS` |
| Shared opacity (Points/Compare/Density) | 0.7 default | `--heatmap-opacity` |
| Density blob radius / blur | 32px / 26px | `L.heatLayer(...)` |
| Density gradient stops | 5, `#f0d56a → #6e0c0c` | `DENSITY_GRADIENT_STOPS` |
| Compare stacking radius | 9px | `stackOffset()` call site |
| Pin stacking radius | 12px | `stackOffset()` call site |
| Pin size | 22px × 30px | `PIN_WIDTH` / `PIN_HEIGHT` |
