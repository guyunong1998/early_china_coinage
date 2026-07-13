'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { MintTown } from '@/lib/mint-towns'

export function MintsOverviewMap({ mints }: { mints: MintTown[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)

  const locatedMints = mints.filter(
    (m): m is MintTown & { lat: number; lng: number } => m.lat != null && m.lng != null
  )

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const { default: L } = await import('leaflet')
      if (cancelled || !containerRef.current || mapInstanceRef.current) return

      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current).setView([36, 111], 5)
      mapInstanceRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      const bounds: [number, number][] = []

      locatedMints.forEach((mint) => {
        bounds.push([mint.lat, mint.lng])

        L.marker([mint.lat, mint.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              width:13px;height:13px;
              background:#c0392b;
              border:2px solid white;
              border-radius:50%;
              box-shadow:0 0 4px rgba(0,0,0,0.35);
            "></div>`,
            iconSize: [13, 13],
            iconAnchor: [6, 6],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:13px">
              <strong>${mint.name_zh} ${mint.name_en}</strong><br/>
              ${mint.state_zh} · ${mint.modern_location_en}<br/>
              <a href="/mints/${mint.mint_code}" style="color:#006d71">View →</a>
            </div>`
          )
      })

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] })
      }
    }

    initMap()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [locatedMints])

  return <div ref={containerRef} style={{ height: '340px', width: '100%' }} />
}
