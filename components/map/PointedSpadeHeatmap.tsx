'use client'

/**
 * Pure map: mint-town production heatmap, a circle marker per mint town
 * sized/shaded by coin (or ANS specimen) count. No caption, no wrapper —
 * just the map.
 *
 * Used by: components/heatmap/HeatmapPanel.tsx (app/old-ans-spades/page.tsx),
 * which renders its own caption text below it. The map visualizations page's
 * Mint Town tab (components/visualizations/MapVisualization.tsx) has its own
 * copy of this same circle-marker logic folded into components/map/MapVisCanvas.tsx,
 * so it can share that canvas's points/density toggle and coin-type filter.
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { HeatmapSource, PointedSpadeMintStat } from '@/lib/pointed-spade-data'

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
  fill = false,
}: {
  mints: PointedSpadeMintStat[]
  source?: HeatmapSource
  /** Fill the relatively-positioned parent instead of using a fixed 480px
   * height — for full-bleed map layouts (the Mint Town visualization tab). */
  fill?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addStaticMajorRivers } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      const map = L.map(containerRef.current, { zoomControl: false }).setView([37.5, 112], 6)
      mapRef.current = map
      L.control.zoom({ position: 'topright' }).addTo(map)

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { osm, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      satelliteLabels.addTo(map)
      addStaticMajorRivers(L, map)

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
  }, [mints, source, fill])

  if (fill) return <div ref={containerRef} className="absolute inset-0" />
  return <div ref={containerRef} style={{ height: '480px', width: '100%' }} />
}
