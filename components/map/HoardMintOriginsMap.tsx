'use client'

/**
 * Pure map for one site showing the mint towns its coins were issued from
 * ("mint origins") — the site itself plus a point per contributing mint. No
 * caption, no wrapper — just the map.
 *
 * Used by: app/sites/[site_code]/page.tsx, which renders its own caption
 * below it.
 */

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

// Marker look (size + role color) comes from app/maps.css — no inline
// styles. Leaflet's vector layers (the dashed connector line below) can't
// take a CSS class, so that one line color still needs a real JS value; it
// reads the same --map-dot-special token the mint dot's CSS class uses, so
// retinting that variable keeps both in sync.
const MINT_LINE_COLOR = 'var(--map-dot-special)'

function makeDot(role: string, size: number) {
  return `<div class="map-dot map-dot-size-${size} ${role}"></div>`
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
          html: makeDot('map-dot-hoard-site', 20),
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
          { color: MINT_LINE_COLOR, weight: 1.5, opacity: 0.55, dashArray: '4 5' }
        ).addTo(map)

        const coinTypesList = mint.coinTypes.length > 0 ? mint.coinTypes.join('、') : '—'

        L.marker([mint.lat, mint.lng], {
          icon: L.divIcon({
            className: '',
            html: makeDot('map-dot-hoard-mint', 14),
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

  return <div ref={containerRef} style={{ height: '360px', width: '100%' }} />
}
