'use client'

/**
 * Pure map: the mint town's own location plus the (already-filtered) find
 * sites where coins issued from it were discovered. No filter UI, no
 * caption, no wrapper — just the map.
 *
 * Used by: components/mints/MintIssueDistribution.tsx
 * (app/mints/[mint_code]/page.tsx), which owns the coin-type filter that
 * decides which sites to pass in.
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { MapSite } from '@/lib/types'

type MintIssueDistributionMapCanvasProps = {
  mint: {
    name_zh: string
    name_en: string
    lat: number
    lng: number
  }
  sites: MapSite[]
}

// Marker look (size + role color) comes from app/maps.css — `.map-dot-mint-
// center` / `.map-dot-mint-issue-site` — no inline styles.
function makeDot(role: string, size: number) {
  return `<div class="map-dot map-dot-size-${size} ${role}"></div>`
}

export function MintIssueDistributionMapCanvas({ mint, sites }: MintIssueDistributionMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addStaticMajorRivers } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      const map = L.map(containerRef.current).setView([mint.lat, mint.lng], 6)
      mapRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { osm, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      satelliteLabels.addTo(map)
      addStaticMajorRivers(L, map)

      const bounds: [number, number][] = [[mint.lat, mint.lng]]

      // Mint center marker
      L.marker([mint.lat, mint.lng], {
        icon: L.divIcon({
          className: '',
          html: makeDot('map-dot-mint-center', 18),
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:13px">
            <strong>Mint town</strong><br/>
            ${mint.name_zh} ${mint.name_en}
          </div>`
        )

      sites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        L.marker([site.lat, site.lng], {
          icon: L.divIcon({
            className: '',
            html: makeDot('map-dot-mint-issue-site', 12),
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:13px;min-width:190px">
              <strong>${site.site_name_zh ?? site.site_code}</strong><br/>
              ${[site.province_zh, site.city_zh, site.county_zh].filter(Boolean).join(' ')}<br/>
              数量: ${site.total_quantity_for_map ?? 0}<br/>
              <a href="/sites/${site.site_code}" style="color:#006d71">View record →</a>
            </div>`
          )
      })

      map.fitBounds(bounds, { padding: [30, 30] })
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [sites, mint.lat, mint.lng, mint.name_en, mint.name_zh])

  return <div ref={containerRef} style={{ height: '360px', width: '100%' }} />
}
