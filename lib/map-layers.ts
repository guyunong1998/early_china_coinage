/**
 * Shared tile layer definitions for all Leaflet maps.
 */
type LeafletNS = typeof import('leaflet')

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

  // Transparent label overlay for satellite mode
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
  satelliteLabels: import('leaflet').TileLayer
) {
  let labelsActive = false

  map.on('baselayerchange', (e: import('leaflet').LayersControlEvent) => {
    if (e.name === 'Satellite') {
      if (!labelsActive) {
        satelliteLabels.addTo(map)
        labelsActive = true
      }
    } else {
      if (labelsActive) {
        map.removeLayer(satelliteLabels)
        labelsActive = false
      }
    }
  })

  L.control
    .layers(
      { 'Street map': osm, Satellite: satellite },
      {},
      { collapsed: false, position: 'topright' }
    )
    .addTo(map)
}
