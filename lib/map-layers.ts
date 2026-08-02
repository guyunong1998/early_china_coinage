/**
 * Shared tile layer definitions for all Leaflet maps.
 */
import { PLACE_LABELS } from '@/lib/place-labels'

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

type RiverMode = 'off' | 'major' | 'minor' | 'all'

const RIVER_MODES: { mode: RiverMode; label: string }[] = [
  { mode: 'off', label: 'Off' },
  { mode: 'major', label: 'Major rivers' },
  { mode: 'minor', label: 'Minor rivers' },
  { mode: 'all', label: 'All rivers' },
]

/**
 * Adds a small standalone control that switches between showing no rivers,
 * only the major river network, only minor tributaries, or both together.
 */
function addRiverModeControl(
  L: LeafletNS,
  map: import('leaflet').Map,
  majorRivers: import('leaflet').LayerGroup,
  minorRivers: import('leaflet').LayerGroup,
  defaultMode: RiverMode = 'major',
  position: import('leaflet').ControlPosition = 'topright'
) {
  function applyMode(mode: RiverMode) {
    map.removeLayer(majorRivers)
    map.removeLayer(minorRivers)
    if (mode === 'major' || mode === 'all') majorRivers.addTo(map)
    if (mode === 'minor' || mode === 'all') minorRivers.addTo(map)
  }

  const RiverControl = L.Control.extend({
    options: { position },
    onAdd() {
      const container = L.DomUtil.create('div', 'leaflet-bar river-mode-control')
      container.style.background = 'white'
      container.style.padding = '6px 10px'
      container.style.fontSize = '12px'
      container.style.fontFamily = 'sans-serif'
      container.style.lineHeight = '1.7'
      container.style.color = '#333'
      container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)'

      const title = document.createElement('div')
      title.textContent = 'Rivers'
      title.style.fontWeight = '600'
      title.style.marginBottom = '4px'
      container.appendChild(title)

      RIVER_MODES.forEach(({ mode, label }) => {
        const row = document.createElement('label')
        row.style.display = 'block'
        row.style.cursor = 'pointer'
        row.style.whiteSpace = 'nowrap'

        const input = document.createElement('input')
        input.type = 'radio'
        input.name = 'river-mode'
        input.value = mode
        input.checked = mode === defaultMode
        input.style.marginRight = '5px'
        input.addEventListener('change', () => applyMode(mode))

        row.appendChild(input)
        row.appendChild(document.createTextNode(label))
        container.appendChild(row)
      })

      L.DomEvent.disableClickPropagation(container)
      return container
    },
  })

  new RiverControl().addTo(map)
  applyMode(defaultMode)
}

export function buildBaseLayers(L: LeafletNS) {
  // The default (and only) base layer across the site — the Consortium of
  // Ancient World Mappers' hillshaded terrain basemap, a better fit for a
  // historical/archaeological atlas than a modern street map. Its own tiles
  // only go up to zoom 11 (maxNativeZoom); maxZoom stays high so Leaflet
  // just upscales the last tile instead of leaving deep zooms blank.
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

  // CyclOSM — a modern OpenStreetMap-derived basemap, offered as a third
  // alternative alongside the hillshaded terrain and satellite base layers.
  // Carries its own place-name/road labels, so it's used as-is rather than
  // paired with the labelsEn/labelsZh overlays above.
  const cyclosm = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    attribution:
      'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.cyclosm.org">CyclOSM</a> hosted by <a href="https://openstreetmap.fr">OpenStreetMap France</a>',
    maxZoom: 20,
  })

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
  const labelsZh = buildPlaceLabelsLayer(L)

  return { cawm, satellite, cyclosm, labelsEn, labelsZh }
}

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
 * Full interactive chrome: the Ancient World Map/Satellite base-layer
 * switcher, plus the Off/Major/Minor/All river-mode control. Reserved for
 * the dedicated Map Visualizations pages (desktop only — see
 * `addStaticMajorRivers` below for every other map, and for all maps on
 * mobile screens). The place-name label layer isn't part of this control —
 * it's always on, following the language toggle (`setLabelLayerForLang`),
 * not a manual overlay checkbox.
 */
export function addLayerControl(
  L: LeafletNS,
  map: import('leaflet').Map,
  cawm: import('leaflet').TileLayer,
  satellite: import('leaflet').TileLayer,
  cyclosm: import('leaflet').TileLayer,
  options?: { collapsed?: boolean; position?: import('leaflet').ControlPosition }
) {
  const position = options?.position ?? 'topright'

  L.control
    .layers(
      // CAWM (already the active base layer when this control is built —
      // see MapVisCanvas's init effect) stays first/checked.
      { 'Ancient World Map': cawm, Satellite: satellite, CyclOSM: cyclosm },
      {},
      { collapsed: options?.collapsed ?? false, position }
    )
    .addTo(map)

  const majorRivers = buildRiverLayer(L, map, '/data/rivers-major.geojson')
  const minorRivers = buildRiverLayer(L, map, '/data/rivers-minor.geojson')
  addRiverModeControl(L, map, majorRivers, minorRivers, 'major', position)
}

/**
 * Every map outside the dedicated Map Visualizations pages (and every map on
 * mobile screens, including those pages): no layer-switcher or river-mode
 * controls at all — just the major river network, always on, as a fixed
 * reference layer with no way to toggle it off.
 */
export function addStaticMajorRivers(L: LeafletNS, map: import('leaflet').Map) {
  buildRiverLayer(L, map, '/data/rivers-major.geojson').addTo(map)
}
