'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'

export type HoardMintOrigin = {
  mint_code?: string
  mint_zh: string
  mint_en?: string | null
  lat: number
  lng: number
  quantity: number
  findCount: number
  coinTypes: string[]
}

type HoardMintOriginsMapProps = {
  site: {
    site_code: string
    name_zh: string | null
    name_en?: string | null
    lat: number
    lng: number
  }
  mints: HoardMintOrigin[]
}

function makeDot(color: string, size = 12) {
  return `<div style="
    width:${size}px;height:${size}px;
    background:${color};
    border:2px solid white;
    border-radius:999px;
    box-shadow:0 0 4px rgba(0,0,0,0.35);
  "></div>`
}

export function HoardMintOriginsMap({ site, mints }: HoardMintOriginsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      const map = L.map(containerRef.current).setView([site.lat, site.lng], 5)
      mapRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      const bounds: [number, number][] = [[site.lat, site.lng]]

      // Findspot (hoard) marker — larger, teal, drawn on top
      const siteMarker = L.marker([site.lat, site.lng], {
        icon: L.divIcon({
          className: '',
          html: makeDot('#006d71', 20),
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:13px;min-width:170px">
            <strong>Findspot / 发现地</strong><br/>
            ${site.name_zh ?? site.site_code}
          </div>`
        )
      siteMarker.openPopup()

      mints.forEach((mint) => {
        bounds.push([mint.lat, mint.lng])

        // Dashed line connecting the hoard to each mint of origin
        L.polyline(
          [
            [site.lat, site.lng],
            [mint.lat, mint.lng],
          ],
          { color: '#c0392b', weight: 1.5, opacity: 0.55, dashArray: '4 5' }
        ).addTo(map)

        const coinTypesList = mint.coinTypes.length > 0 ? mint.coinTypes.join('、') : '—'

        L.marker([mint.lat, mint.lng], {
          icon: L.divIcon({
            className: '',
            html: makeDot('#c0392b', 14),
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:13px;min-width:200px;line-height:1.5">
              <strong>Mint town / 铸币地：</strong>${mint.mint_zh}${mint.mint_en ? ` <span style="color:#888;font-style:italic">(${mint.mint_en})</span>` : ''}<br/>
              <strong>Coin types / 币类：</strong>${coinTypesList}<br/>
              <strong>Quantity in this hoard / 数量：</strong>${mint.quantity || mint.findCount}<br/>
              ${mint.mint_code ? `<a href="/mints/${mint.mint_code}" style="color:#006d71">View mint town →</a>` : ''}
            </div>`
          )
      })

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] })
      } else {
        map.setView([site.lat, site.lng], 6)
      }
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [site.lat, site.lng, site.name_zh, site.site_code, mints])

  return (
    <div className="space-y-2">
      <div ref={containerRef} style={{ height: '360px', width: '100%' }} />
      <p className="text-xs text-gray-500">
        Teal marker: this findspot. Red markers: mint towns that issued coins found here, connected by dashed lines.
      </p>
    </div>
  )
}
