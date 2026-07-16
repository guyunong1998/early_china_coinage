/**
 * Shared tile layer definitions for all Leaflet maps.
 */
type LeafletNS = typeof import('leaflet')

/**
 * River network (Natural Earth 1:10m, ranked by relative importance).
 * Line geometry is pre-clipped (see scripts/clip-rivers-to-china.js) to only
 * the segments that fall inside China's national boundary polygon — cross-
 * border rivers like the Mekong/Lancang, Amur/Heilong Jiang, or Indus keep
 * only their China-side stretch, and rivers that are entirely foreign (e.g.
 * Ganges, Krishna, Ayeyarwady) are dropped.
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

const RIVER_COLOR = '#0f6fc5'
const RIVER_HALO_COLOR = '#ffffff'

function riverWeight(rank: number) {
  if (rank <= 1) return 3.2
  if (rank === 2) return 2.6
  if (rank === 3) return 2.0
  if (rank === 4) return 2.0
  if (rank === 5) return 1.7
  if (rank === 6) return 1.4
  if (rank === 7) return 1.2
  return 1.0
}

function riverHaloWeight(rank: number) {
  // Major rivers get a generously wide halo; minor/tributary lines get a
  // tighter one so they stay crisp instead of turning into a blurry blob.
  return riverWeight(rank) + (rank <= 3 ? 2.2 : 1.4)
}

function buildRiverLayer(L: LeafletNS, url: string) {
  const group = L.layerGroup()

  fetch(url)
    .then((res) => res.json())
    .then((geojson) => {
      type RiverFeature = import('geojson').Feature<import('geojson').Geometry, RiverProps>

      // A pale halo drawn underneath makes the river pop against both light
      // street-map tiles and dark/green satellite imagery.
      const haloStyle = (feature?: RiverFeature) => {
        const rank = feature?.properties?.scalerank ?? 5
        return { color: RIVER_HALO_COLOR, weight: riverHaloWeight(rank), opacity: 0.75 }
      }

      const mainStyle = (feature?: RiverFeature) => {
        const rank = feature?.properties?.scalerank ?? 5
        return { color: RIVER_COLOR, weight: riverWeight(rank), opacity: 1 }
      }

      L.geoJSON<RiverProps>(geojson, { style: haloStyle, interactive: false }).addTo(group)

      L.geoJSON<RiverProps>(geojson, {
        style: mainStyle,
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name
          if (name) layer.bindTooltip(name, { sticky: true, className: 'river-tooltip' })
        },
      }).addTo(group)
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
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  })

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles © <a href="https://www.esri.com">Esri</a> — Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
      maxZoom: 19,
    }
  )

  // Transparent English place-name/boundary overlay (Esri's reference
  // layer). OSM's own "Street map" tiles are labelled in the local script
  // (Chinese, for places in China), so layering this on top gives a
  // bilingual view; it's also the only source of text on the label-less
  // satellite imagery. Togglable via the "English labels" overlay checkbox.
  const satelliteLabels = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: '', maxZoom: 19, opacity: 1 }
  )

  return { osm, satellite, satelliteLabels }
}

export function addLayerControl(
  L: LeafletNS,
  map: import('leaflet').Map,
  osm: import('leaflet').TileLayer,
  satellite: import('leaflet').TileLayer,
  satelliteLabels: import('leaflet').TileLayer,
  options?: { collapsed?: boolean; position?: import('leaflet').ControlPosition }
) {
  // On by default on top of either base layer — gives bilingual labels on
  // the street map, and is the only text shown on the satellite view. Users
  // can switch it off via the overlay checkbox if it feels cluttered.
  satelliteLabels.addTo(map)

  const position = options?.position ?? 'topright'

  L.control
    .layers(
      { 'Street map': osm, Satellite: satellite },
      { 'English labels': satelliteLabels },
      { collapsed: options?.collapsed ?? false, position }
    )
    .addTo(map)

  const majorRivers = buildRiverLayer(L, '/data/rivers-major.geojson')
  const minorRivers = buildRiverLayer(L, '/data/rivers-minor.geojson')
  addRiverModeControl(L, map, majorRivers, minorRivers, 'major', position)
}
