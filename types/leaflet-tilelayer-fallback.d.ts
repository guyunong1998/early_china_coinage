import type { TileLayer, TileLayerOptions } from 'leaflet'

declare module 'leaflet' {
  namespace TileLayer {
    class Fallback extends TileLayer {}
  }

  namespace tileLayer {
    function fallback(urlTemplate: string, options?: TileLayerOptions): TileLayer.Fallback
  }
}
