'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { PointedSpadeMintStat } from '@/lib/pointed-spade-data'

import type { HeatmapSource } from '@/components/heatmap/HeatmapPanel'

function heatRadius(coinCount: number, maxCount: number) {
  if (maxCount <= 0) return 12
  const t = Math.sqrt(coinCount / maxCount)
  return 10 + t * 34
}

function heatOpacity(coinCount: number, maxCount: number) {
  if (coinCount <= 0) return 0.35
  if (maxCount <= 0) return 0.35
  return 0.35 + (coinCount / maxCount) * 0.45
}

export function PointedSpadeHeatmap({
  mints,
  source = 'database',
}: {
  mints: PointedSpadeMintStat[]
  source?: HeatmapSource
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      const map = L.map(containerRef.current).setView([37.5, 112], 6)
      mapRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      const maxCount = Math.max(...mints.map((m) => m.coinCount), 1)
      const bounds: [number, number][] = []

      mints.forEach((mint) => {
        bounds.push([mint.lat, mint.lng])

        L.circleMarker([mint.lat, mint.lng], {
          radius: heatRadius(mint.coinCount, maxCount),
          fillColor: '#c0392b',
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: heatOpacity(mint.coinCount, maxCount),
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:180px">
              <strong>${mint.mint_zh}${mint.mint_en ? ` <span style="color:#888;font-style:italic">(${mint.mint_en})</span>` : ''}</strong><br/>
              <strong>${source === 'database' ? 'Coins in database' : 'ANS specimens'}:</strong> ${mint.coinCount || mint.findCount}<br/>
              ${source === 'database' ? `<strong>Find records:</strong> ${mint.findCount}<br/>` : ''}
              ${mint.inscriptions.length > 0 ? `<strong>Inscriptions:</strong> ${mint.inscriptions.slice(0, 6).join('、')}${mint.inscriptions.length > 6 ? '…' : ''}<br/>` : ''}
              ${mint.modern_location_en ? `${mint.modern_location_en}<br/>` : ''}
              ${mint.mint_code ? `<a href="/mints/${mint.mint_code}" style="color:#006d71">View mint town →</a>` : ''}
            </div>`
          )
      })

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mints, source])

  return (
    <div className="space-y-2">
      <div ref={containerRef} style={{ height: '480px', width: '100%' }} />
      <p className="text-xs text-gray-500">
        Circle size and intensity reflect the number of{' '}
        {source === 'database' ? 'coins recorded in the database' : 'ANS catalogue specimens'} for each
        mint town. Only mints with mapped coordinates are shown.
      </p>
    </div>
  )
}
