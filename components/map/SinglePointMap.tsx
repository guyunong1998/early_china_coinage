'use client'

/**
 * Generic single-marker map for one lat/lng point (configurable height/zoom).
 *
 * Used by: app/mints/[mint_code]/page.tsx (the mint town's own location).
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'

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

      const { buildBaseLayers, addStaticMajorRivers } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], zoom)
      mapInstanceRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { osm, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      satelliteLabels.addTo(map)
      addStaticMajorRivers(L, map)

      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="map-dot map-dot-size-16 map-dot-single-point"></div>',
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
