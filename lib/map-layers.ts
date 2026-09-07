/**
 * Shared tile layer definitions for all Leaflet maps.
 */
import { PLACE_LABELS } from '@/lib/place-labels'
import { toEnglishName } from '@/lib/name-translation'

type LeafletNS = typeof import('leaflet')

/**
 * River network (Natural Earth 1:10m, ranked by relative importance).
 * Line geometry is pre-clipped (see scripts/clip-rivers-to-china.js) to the
 * segments that fall within a generously buffered version of China's
 * national boundary (800km) — cross-border rivers like the Mekong/Lancang,
 * Amur/Heilong Jiang, or Red River/Yuan Jiang trail off well past the
 * modern border instead of snapping off exactly at it; only rivers entirely
 * far outside that buffer (e.g. Ganges, Krishna) are dropped.
 * "Major" = scalerank 0–3 (trunk rivers, e.g. Yangtze/Chang Jiang, Yellow
 * River/Huang, Mekong/Lancang). "Minor" = scalerank 4–9, i.e. everything below
 * the trunk tier. This is wider than a naive "4–5" cut: at global 1:10m scale,
 * rivers that are historically central to early Chinese coinage — Wei He
 * (rank 8), Fen He (rank 9), Zhang He (rank 8), Jing He (rank 8), Hai He/
 * Sanggan He/Yongding He (rank 7) — rank far below 5 simply because Natural
 * Earth ranks by global prominence, not regional/historical significance.
 * Both tiers are loaded lazily from static GeoJSON files so this works with
 * static export.
 */
type RiverProps = { scalerank?: number; name?: string | null }

// Matches the CAWM basemap's own ocean/water fill color (sampled from its
// tiles: rgb(97,163,224)) so rivers read as "more of the same water" laid
// over that basemap rather than an unrelated blue.
const RIVER_COLOR = '#61a3e0'

// Base weights below are tuned to look right around REFERENCE_ZOOM (a
// typical "looking at one region" zoom level, e.g. the sites overview map).
// Leaflet vector weights are constant screen pixels regardless of zoom, so
// without this a river covers vastly more ground at a zoomed-out world view
// than at REFERENCE_ZOOM while staying the same thickness on screen -- it
// reads as far too bold/prominent zoomed out, and a bit thin zoomed in. This
// scales weight down for lower zooms and up (mildly, capped) for higher
// ones, so line thickness stays roughly proportionate to what's on screen.
const REFERENCE_ZOOM = 6
const MIN_ZOOM_SCALE = 0.2
const MAX_ZOOM_SCALE = 1.4

function zoomScale(zoom: number) {
  const factor = Math.pow(2, (zoom - REFERENCE_ZOOM) / 3)
  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, factor))
}

function riverWeight(rank: number, zoom: number) {
  const base =
    rank <= 1 ? 3.2 : rank === 2 ? 2.6 : rank === 3 ? 2.0 : rank === 4 ? 2.0 : rank === 5 ? 1.7 : rank === 6 ? 1.4 : rank === 7 ? 1.2 : 1.0
  return base * zoomScale(zoom)
}

function riverHaloWeight(rank: number, zoom: number) {
  // Major rivers get a generously wide halo; minor/tributary lines get a
  // tighter one so they stay crisp instead of turning into a blurry blob.
  return riverWeight(rank, zoom) + (rank <= 3 ? 2.2 : 1.4) * zoomScale(zoom)
}

function buildRiverLayer(L: LeafletNS, map: import('leaflet').Map, url: string) {
  const group = L.layerGroup()

  fetch(url)
    .then((res) => res.json())
    .then((geojson) => {
      type RiverFeature = import('geojson').Feature<import('geojson').Geometry, RiverProps>

      // A soft halo drawn underneath, in the same water color as the river
      // itself (just a touch more transparent) rather than a stark white
      // outline, so it reads as a gentle glow instead of a cutout edge.
      const haloStyle = (feature?: RiverFeature) => {
        const rank = feature?.properties?.scalerank ?? 5
        return { color: RIVER_COLOR, weight: riverHaloWeight(rank, map.getZoom()), opacity: 0.0 }
      }

      const mainStyle = (feature?: RiverFeature) => {
        const rank = feature?.properties?.scalerank ?? 5
        return { color: RIVER_COLOR, weight: riverWeight(rank, map.getZoom()), opacity: 0.8 }
      }

      const haloLayer = L.geoJSON<RiverProps>(geojson, { style: haloStyle, interactive: false }).addTo(group)

      const mainLayer = L.geoJSON<RiverProps>(geojson, {
        style: mainStyle,
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name
          if (name) layer.bindTooltip(name, { sticky: true, className: 'river-tooltip' })
        },
      }).addTo(group)

      // Re-derive both layers' weights whenever the zoom settles, rather
      // than continuously mid-gesture -- setStyle on a couple thousand
      // line features isn't free, and zoomend already fires once the user
      // stops scrolling/pinching.
      map.on('zoomend', () => {
        haloLayer.setStyle(haloStyle)
        mainLayer.setStyle(mainStyle)
      })
    })
    .catch(() => {
      // River overlay is a non-essential visual layer — fail silently.
    })

  return group
}

/**
 * Historical route network + its named nodes, converted from the route0180 /
 * Node shapefiles by scripts/convert-routes-shapefile.mjs.
 *
 * Each `routelevel` gets its own cartographic line style, all sharing the
 * same orange and no halo (a plain stroke straight on the basemap, not a
 * glow):
 *   1 (trunk)     — single solid line, twice the weight of level 2.
 *   2 (secondary) — single solid line.
 *   3 (tertiary)  — dashed line.
 *
 * Edges only reveal their level via a bound popup (click to open), unlike
 * the nodes below (hover tooltip) — deliberately asymmetric so a route
 * segment's tooltip can't flash open just from a pointer passing over the
 * network while panning. Both are bilingual (Chinese + English together, not
 * gated by the site's language toggle) — nodes carry only a Chinese name in
 * the source data, so the English side falls back to pinyin the same way
 * lib/name-translation.ts does for mint names.
 */
type RouteProps = { routelevel?: number | null }
type RouteNodeProps = { id?: number | null; name?: string | null }

const ROUTE_COLOR = '#b45309'
const ROUTE_NODE_COLOR = '#7c2d12'

/** Pane name → z-index, in paint order. Above Leaflet's overlayPane (400),
 *  below its markerPane (600) so find-site coin markers stay on top. */
const ROUTE_PANES = {
  line: 402,
  nodes: 403,
} as const

const ROUTE_DASH = '7 5'

// Base weights, tuned to look right at REFERENCE_ZOOM — scaled by the same
// zoomScale() the river layers use so routes thin out at low zooms instead
// of staying a constant (and increasingly heavy-looking) screen width as the
// view pulls back to cover more ground. Trunk has no weight of its own —
// it's always drawn at exactly twice the secondary weight.
const ROUTE_BASE_WEIGHTS = {
  secondary: 2.6,
  tertiary: 2,
} as const

const ROUTE_NODE_BASE_RADIUS = 3

function routeWeight(base: number, zoom: number) {
  return base * zoomScale(zoom)
}

function ensurePane(map: import('leaflet').Map, name: string, zIndex: number) {
  const pane = map.getPane(name) ?? map.createPane(name)
  pane.style.zIndex = String(zIndex)
  return name
}

/** Chinese + English shown together for a route's click popup — not gated by
 *  the language toggle, since both should always be visible per-line. */
const ROUTE_LEVEL_LABELS: Record<number, { zh: string; en: string }> = {
  1: { zh: '干道', en: 'Trunk route' },
  2: { zh: '支线', en: 'Secondary route' },
  3: { zh: '小路', en: 'Tertiary route' },
}

function bilingualHtml(zh: string, en: string) {
  return `<span>${zh}<span style="margin-left:6px;font-style:italic;color:#9ca3af;font-size:0.85em;">${en}</span></span>`
}

function buildRoutesLayer(
  L: LeafletNS,
  map: import('leaflet').Map,
  linesUrl = '/data/routes.geojson',
  nodesUrl = '/data/route-nodes.geojson'
) {
  const group = L.layerGroup()

  const panes = {
    line: ensurePane(map, 'routes-line', ROUTE_PANES.line),
    nodes: ensurePane(map, 'routes-nodes', ROUTE_PANES.nodes),
  }

  fetch(linesUrl)
    .then((res) => res.json())
    .then((geojson: import('geojson').FeatureCollection) => {
      type RouteFeature = import('geojson').Feature<import('geojson').Geometry, RouteProps>

      const atLevel = (level: number) => ({
        ...geojson,
        features: geojson.features.filter(
          (f) => ((f.properties as RouteProps)?.routelevel ?? 2) === level
        ),
      })

      // Click-only: a bound Popup (unlike Tooltip) only ever opens on click
      // in Leaflet, never on hover, which is exactly the "must be clicked"
      // behavior wanted for edges — the nodes below keep the hover tooltip.
      const clickPopup = (feature: RouteFeature, layer: import('leaflet').Layer) => {
        const level = feature.properties?.routelevel
        const label = level != null ? ROUTE_LEVEL_LABELS[level] : null
        if (!label) return
        layer.bindPopup(bilingualHtml(label.zh, label.en), { closeButton: false, className: 'river-tooltip' })
      }

      // Level 1 — single solid line, twice the weight of level 2.
      const trunkStyle = () => ({
        color: ROUTE_COLOR,
        weight: 2 * routeWeight(ROUTE_BASE_WEIGHTS.secondary, map.getZoom()),
        opacity: 0.85,
        lineCap: 'round' as const,
        lineJoin: 'round' as const,
      })

      const trunk = atLevel(1)
      const trunkLayer = L.geoJSON(trunk, {
        pane: panes.line,
        style: trunkStyle,
        onEachFeature: clickPopup,
      }).addTo(group)

      // Level 2 — plain solid line.
      const secondaryLineStyle = () => ({
        color: ROUTE_COLOR,
        weight: routeWeight(ROUTE_BASE_WEIGHTS.secondary, map.getZoom()),
        opacity: 0.8,
        lineCap: 'round' as const,
        lineJoin: 'round' as const,
      })

      const secondary = atLevel(2)
      const secondaryLineLayer = L.geoJSON(secondary, {
        pane: panes.line,
        style: secondaryLineStyle,
        onEachFeature: clickPopup,
      }).addTo(group)

      // Level 3 — dashed, tighter rhythm than the trunk's.
      const tertiaryLineStyle = () => ({
        color: ROUTE_COLOR,
        weight: routeWeight(ROUTE_BASE_WEIGHTS.tertiary, map.getZoom()),
        opacity: 0.8,
        dashArray: ROUTE_DASH,
        lineCap: 'butt' as const,
      })

      const tertiary = atLevel(3)
      const tertiaryLineLayer = L.geoJSON(tertiary, {
        pane: panes.line,
        style: tertiaryLineStyle,
        onEachFeature: clickPopup,
      }).addTo(group)

      // Re-derive every tier's weight whenever the zoom settles, the same
      // "recompute once on zoomend, not mid-gesture" approach the river
      // layers use — otherwise these lines never fall below their
      // REFERENCE_ZOOM weight, making a low zoom's routes look far too heavy
      // relative to how much ground they now cover.
      map.on('zoomend', () => {
        trunkLayer.setStyle(trunkStyle)
        secondaryLineLayer.setStyle(secondaryLineStyle)
        tertiaryLineLayer.setStyle(tertiaryLineStyle)
      })
    })
    .catch(() => {
      // Route overlay is non-essential — fail silently.
    })

  fetch(nodesUrl)
    .then((res) => res.json())
    .then((geojson) => {
      const nodeRadius = () => routeWeight(ROUTE_NODE_BASE_RADIUS, map.getZoom())

      const nodesLayer = L.geoJSON<RouteNodeProps>(geojson, {
        pane: panes.nodes,
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            pane: panes.nodes,
            radius: nodeRadius(),
            color: ROUTE_NODE_COLOR,
            weight: 1,
            opacity: 0.9,
            fillColor: ROUTE_NODE_COLOR,
            fillOpacity: 0.85,
          }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name
          if (!name) return
          // Nodes only carry a Chinese name in the source shapefile — the
          // English side falls back to tone-less pinyin, same convention
          // lib/name-translation.ts uses for mint names with no translation.
          const en = toEnglishName(name, null)
          layer.bindTooltip(bilingualHtml(name, en), { direction: 'top', className: 'river-tooltip' })
        },
      }).addTo(group)

      // Shrink the node dots at low zoom too, to match the thinned-out
      // routes — CircleMarker.setRadius isn't part of GeoJSON's generic
      // setStyle, so each marker is updated directly.
      map.on('zoomend', () => {
        const radius = nodeRadius()
        nodesLayer.eachLayer((layer) => {
          if (layer instanceof L.CircleMarker) layer.setRadius(radius)
        })
      })
    })
    .catch(() => {
      // Node overlay is non-essential — fail silently.
    })

  return group
}

export function buildBaseLayers(L: LeafletNS) {
  // Ancient World Mappers' hillshaded terrain basemap — an alternative to
  // the default CyclOSM base layer (see the cyclosm tile layer below) for a
  // historical/archaeological atlas look. Its own tiles only go up to zoom
  // 11 (maxNativeZoom); maxZoom stays high so Leaflet just upscales the
  // last tile instead of leaving deep zooms blank.
  const cawm = L.tileLayer('https://cawm.lib.uiowa.edu/tiles/{z}/{x}/{y}.png', {
    attribution:
      'Basemap © <a href="https://cawm.lib.uiowa.edu">Consortium of Ancient World Mappers</a>',
    maxZoom: 19,
    maxNativeZoom: 11,
  })

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles © <a href="https://www.esri.com">Esri</a> — Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
      maxZoom: 19,
    }
  )

  // CyclOSM — a modern OpenStreetMap-derived basemap, and the default base
  // layer across the site (see each map component's `cyclosm.addTo(map)`).
  // The hillshaded terrain (cawm) and satellite layers above remain as
  // alternatives via the layer switcher on the dedicated Map Visualizations
  // pages.
  const cyclosm = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    attribution:
      'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.cyclosm.org">CyclOSM</a> hosted by <a href="https://openstreetmap.fr">OpenStreetMap France</a>',
    maxZoom: 20,
  })

  // Plain OpenStreetMap Carto — CyclOSM above is also OSM data, but its
  // cycling-oriented styling pushes roads and paths forward; this is the
  // standard rendering, for reading present-day place names and admin
  // boundaries straight.
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  })

  // 高德 / AutoNavi — Chinese street map with built-in zh labels. Tiles are
  // GCJ-02; our find/mint coordinates are WGS84, so markers can sit a short
  // distance off roads/cities inside China (same caveat as any GCJ basemap
  // under Leaflet's default CRS). Still useful for reading present-day
  // Chinese place names next to CyclOSM/OSM.
  const amap = L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: ['1', '2', '3', '4'],
      attribution: '© <a href="https://www.amap.com/">高德地图</a> / AutoNavi',
      maxZoom: 18,
    }
  )

  // Transparent English/romanized place-name overlay (Esri's reference
  // layer). Neither base layer (the Stamen terrain background nor the
  // satellite imagery) carries any place labels of its own, so one of these
  // two label layers is always the only source of text on the map — which
  // one is active follows the site's language toggle (see
  // `setLabelLayerForLang` below), not a manual checkbox.
  const labelsEn = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: '', maxZoom: 19, opacity: 1 }
  )

  // Chinese-script place-name overlay — the zh counterpart to Esri's English
  // layer above, but self-authored (see buildPlaceLabelsLayer) rather than a
  // third-party tile: every public AutoNavi/Amap annotation tile bundles a
  // full road network with the labels (no way to get just the text), and
  // Esri/Stadia/CartoDB's own label tiles only ever render English/pinyin
  // regardless of language. A small hand-picked city list sidesteps that —
  // same plain "dot + text" look as the English layer, no road clutter.
  // (When the 高德 basemap is selected it already draws its own zh labels;
  // this overlay may then sit on top — acceptable for the language toggle.)
  const labelsZh = buildPlaceLabelsLayer(L)

  return { cawm, satellite, cyclosm, osm, amap, labelsEn, labelsZh }
}

export type BaseLayers = ReturnType<typeof buildBaseLayers>

/**
 * Builds the Chinese place-label layer from the static list in
 * lib/place-labels.ts — a small dot plus a permanent text tooltip per city,
 * styled by `.place-label-tooltip` in app/maps.css to read as plain text
 * (no bubble/arrow chrome) rather than a normal Leaflet tooltip popup.
 */
function buildPlaceLabelsLayer(L: LeafletNS) {
  const group = L.layerGroup()
  PLACE_LABELS.forEach(({ lat, lng, zh }) => {
    L.circleMarker([lat, lng], {
      radius: 2.5,
      color: '#333',
      weight: 1,
      fillColor: '#333',
      fillOpacity: 1,
      interactive: false,
    })
      .bindTooltip(zh, {
        permanent: true,
        direction: 'right',
        offset: [4, 0],
        className: 'place-label-tooltip',
        interactive: false,
      })
      .addTo(group)
  })
  return group
}

/**
 * Shows the label layer matching `lang` and hides the other one — the
 * single place this decision is made, called both right after the base
 * layers are built (initial state) and again whenever the language toggle
 * changes (see each map component's `[lang]`-keyed effect).
 */
export function setLabelLayerForLang(
  map: import('leaflet').Map,
  labelsEn: import('leaflet').Layer,
  labelsZh: import('leaflet').Layer,
  lang: 'en' | 'zh'
) {
  const show = lang === 'zh' ? labelsZh : labelsEn
  const hide = lang === 'zh' ? labelsEn : labelsZh
  if (map.hasLayer(hide)) map.removeLayer(hide)
  if (!map.hasLayer(show)) show.addTo(map)
}

/**
 * Full interactive chrome, as a single control: the basemap switcher over
 * the toggleable overlays (the two river tiers and the route network), so
 * everything the user can turn on or off lives in one box. Reserved for the
 * dedicated Map Visualizations pages (desktop only — see
 * `addStaticMajorRivers` below for every other map, and for all maps on
 * mobile screens). The place-name label layer isn't part of this control —
 * it's always on, following the language toggle (`setLabelLayerForLang`),
 * not a manual overlay checkbox.
 *
 * The river tiers are two independent checkboxes rather than the
 * Off/Major/Minor/All radio group they replaced: unticking both is "off",
 * ticking both is "all", so no combination was lost by folding them in here.
 */
export function addLayerControl(
  L: LeafletNS,
  map: import('leaflet').Map,
  layers: BaseLayers,
  options?: { collapsed?: boolean; position?: import('leaflet').ControlPosition }
) {
  const { cawm, satellite, cyclosm, osm, amap } = layers
  const position = options?.position ?? 'topright'

  const majorRivers = buildRiverLayer(L, map, '/data/rivers-major.geojson').addTo(map)
  const minorRivers = buildRiverLayer(L, map, '/data/rivers-minor.geojson')
  const routes = buildRoutesLayer(L, map).addTo(map)

  // Leaflet's layer control inserts each key as raw innerHTML, so "Routes &
  // nodes" can carry its own hover-title explanation (a native tooltip, not
  // the app's usual ClickHint popover — this control is plain Leaflet DOM,
  // not React) the same dotted-underline look every other in-app hint uses.
  const routesLabel =
    '<span class="routes-hint-label" title="Ancient trade-route network and its named nodes, from the Tang dynasty (description may change)." ' +
    'style="cursor:help;border-bottom:1px dotted #9ca3af">Routes &amp; nodes</span>'

  const control = L.control
    .layers(
      // CyclOSM (already the active base layer when this control is built —
      // see MapVisCanvas's init effect) stays first/checked.
      {
        CyclOSM: cyclosm,
        '高德地图': amap,
        'Ancient World Map': cawm,
        Satellite: satellite,
        OpenStreetMap: osm,
      },
      {
        'Major rivers': majorRivers,
        'Minor rivers': minorRivers,
        [routesLabel]: routes,
      },
      { collapsed: options?.collapsed ?? false, position }
    )
    .addTo(map)

  // Clicking anywhere in a Leaflet overlay row toggles its checkbox, because
  // the row is a <label> wrapping the input. That swallows clicks meant to
  // read the "Routes & nodes" hint text as a toggle instead. Calling
  // preventDefault() on the click cancels the browser's implicit forwarding
  // of the click to the checkbox, so only the checkbox itself now toggles
  // the layer — the label text becomes hover-only, like the hint it is.
  //
  // This has to be delegated on the control's outer container rather than
  // bound directly to the `.routes-hint-label` span: Leaflet's layer control
  // rebuilds its row DOM (`_update()`, recreating every label/span) whenever
  // *any* layer is added to or removed from the map — which happens
  // constantly here (heat layer, marker clusters, pins toggling as filters
  // and view modes change) — so a listener attached straight to the span
  // gets silently dropped the next time that happens. The outer container
  // itself is stable across those rebuilds, so checking the click target at
  // dispatch time survives them.
  control.getContainer()?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement | null)?.closest('.routes-hint-label')) {
      e.preventDefault()
    }
  })
}

/**
 * Every map outside the dedicated Map Visualizations pages (and every map on
 * mobile screens, including those pages): no layer control at all — just the
 * major river network, always on, as a fixed reference layer with no way to
 * toggle it off.
 */
export function addStaticMajorRivers(L: LeafletNS, map: import('leaflet').Map) {
  buildRiverLayer(L, map, '/data/rivers-major.geojson').addTo(map)
}

/** The route network as a fixed layer, for the same no-controls maps that get
 *  `addStaticMajorRivers` — otherwise routes would vanish entirely below the
 *  768px breakpoint, where the layer control isn't built. */
export function addStaticRoutes(L: LeafletNS, map: import('leaflet').Map) {
  buildRoutesLayer(L, map).addTo(map)
}
