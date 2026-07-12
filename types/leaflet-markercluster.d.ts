declare module 'leaflet.markercluster' {
  import type { LayerGroup } from 'leaflet'

  export function markerClusterGroup(options?: {
    showCoverageOnHover?: boolean
    maxClusterRadius?: number
  }): LayerGroup
}

declare module 'leaflet.markercluster/dist/MarkerCluster.css'
declare module 'leaflet.markercluster/dist/MarkerCluster.Default.css'
