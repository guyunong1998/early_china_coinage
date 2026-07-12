'use client'

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

      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], zoom)
      mapInstanceRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            width:16px;height:16px;
            background:#c0392b;
            border:2.5px solid white;
            border-radius:50%;
            box-shadow:0 0 5px rgba(0,0,0,0.4);
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
