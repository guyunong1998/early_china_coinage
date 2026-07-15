'use client'

/**
 * Generic single-marker map for one lat/lng point (configurable height/zoom).
 *
 * Used by: app/mints/[mint_code]/page.tsx (the mint town's own location).
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'

// Marker fill + border (RGBA). Shared dot chrome (border width, radius,
// shadow) lives in the `.map-dot` class in app/globals.css.
const MARKER_COLOR = 'var(--map-dot-special)'
const MARKER_BORDER_COLOR = 'var(--map-dot-border)'

type SinglePointMapProps = {
  lat: number
  lng: number
  label: string
  height?: string
  zoom?: number
}

export default function SinglePointMap({
  lat,
  lng,
  label,
  height = '320px',
  zoom = 12,
}: SinglePointMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const { default: L } = await import('leaflet')
      if (cancelled || !containerRef.current || mapInstanceRef.current) return

      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], zoom)
      mapInstanceRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="map-dot" style="
            width:16px;height:16px;
            background:${MARKER_COLOR};
            border-color:${MARKER_BORDER_COLOR};
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      })
        .addTo(map)
        .bindPopup(`<strong>${label}</strong>`)
        .openPopup()
    }

    initMap()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [lat, lng, label, zoom])

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}
