'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { MapSite } from '@/lib/types'
import type { MintTypeOption } from '@/lib/queries'

type MintIssueDistributionMapProps = {
  mint: {
    name_zh: string
    name_en: string
    lat: number
    lng: number
  }
  sites: MapSite[]
  siteTypeKeys: Record<string, string[]>
  typeOptions: MintTypeOption[]
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

export function MintIssueDistributionMap({
  mint,
  sites,
  siteTypeKeys,
  typeOptions,
}: MintIssueDistributionMapProps) {
  const [selectedType, setSelectedType] = useState('all')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  const filteredSites = useMemo(() => {
    if (selectedType === 'all') return sites
    return sites.filter((site) => (siteTypeKeys[site.site_code] ?? []).includes(selectedType))
  }, [selectedType, sites, siteTypeKeys])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      const map = L.map(containerRef.current).setView([mint.lat, mint.lng], 6)
      mapRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      const bounds: [number, number][] = [[mint.lat, mint.lng]]

      // Mint center marker
      L.marker([mint.lat, mint.lng], {
        icon: L.divIcon({
          className: '',
          html: makeDot('#c0392b', 18),
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

      filteredSites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        L.marker([site.lat, site.lng], {
          icon: L.divIcon({
            className: '',
            html: makeDot('#006d71', 12),
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
  }, [filteredSites, mint.lat, mint.lng, mint.name_en, mint.name_zh])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="mint-type-filter" className="text-sm font-semibold text-gray-700">
          Coin type filter:
        </label>
        <select
          id="mint-type-filter"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
        >
          <option value="all">All issued coin types ({sites.length} sites)</option>
          {typeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.siteCount})
            </option>
          ))}
        </select>
      </div>

      <div ref={containerRef} style={{ height: '360px', width: '100%' }} />

      <p className="text-xs text-gray-500">
        Red marker: mint location. Teal markers: findspots containing coins issued by this mint.
      </p>
    </div>
  )
}

