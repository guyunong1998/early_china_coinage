import type { Layer, LayerOptions, Map as LeafletMap } from 'leaflet'

declare module 'leaflet' {
  type HeatLatLngTuple = [number, number, number?]

  interface HeatMapOptions extends LayerOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<number, string>
  }

  class HeatLayer extends Layer {
    constructor(latlngs: HeatLatLngTuple[], options?: HeatMapOptions)
    setLatLngs(latlngs: HeatLatLngTuple[]): this
    addLatLng(latlng: HeatLatLngTuple): this
    setOptions(options: HeatMapOptions): this
    redraw(): this
    addTo(map: LeafletMap): this
  }

  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatMapOptions): HeatLayer
}
