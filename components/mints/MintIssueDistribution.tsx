'use client'

/**
 * Mint town page's "Issued Coin Distribution" section: a coin-type filter
 * dropdown, the find-sites map (OriginDistributionMap, a pure map), and a
 * caption below it.
 *
 * Used by: app/mints/[mint_code]/page.tsx.
 */

import { useMemo, useState } from 'react'
import { OriginDistributionMap, type OriginDistributionPoint } from '@/components/map/OriginDistributionMap'
import { T } from '@/components/i18n/T'
import type { MapSite } from '@/lib/types'
import type { MintTypeOption } from '@/lib/queries'

type MintIssueDistributionProps = {
  // null when the mint town's own location isn't established yet.
  mint: {
    name_zh: string
    name_en: string
    lat: number
    lng: number
  } | null
  sites: MapSite[]
  siteTypeKeys: Record<string, string[]>
  typeOptions: MintTypeOption[]
}

// Same yellow used for ratioToColor's low-end ramp stop (lib/color-scale.ts)
// — both the mint's dropped pin and the findspot dots share this one color,
// fully opaque (unlike most map-dot roles, which use a translucent alpha).
const MINT_ISSUE_COLOR = '#eda100'

export function MintIssueDistribution({ mint, sites, siteTypeKeys, typeOptions }: MintIssueDistributionProps) {
  const [selectedType, setSelectedType] = useState('all')

  const filteredSites = useMemo(() => {
    if (selectedType === 'all') return sites
    return sites.filter((site) => (siteTypeKeys[site.site_code] ?? []).includes(selectedType))
  }, [selectedType, sites, siteTypeKeys])

  const origin: OriginDistributionPoint | null = mint
    ? {
        key: 'mint',
        lat: mint.lat,
        lng: mint.lng,
        popupHtml: `<div class="map-popup">
          <strong>Mint town</strong><br/>
          ${mint.name_zh} ${mint.name_en}
        </div>`,
      }
    : null

  const destinations: OriginDistributionPoint[] = filteredSites
    .filter((site): site is MapSite & { lat: number; lng: number } => site.lat != null && site.lng != null)
    .map((site) => ({
      key: site.site_code,
      lat: site.lat,
      lng: site.lng,
      popupHtml: `<div class="map-popup" style="min-width:190px">
        <strong>${site.site_name_zh ?? site.site_code}</strong><br/>
        ${[site.province_zh, site.city_zh, site.county_zh].filter(Boolean).join(' ')}<br/>
        数量: ${site.total_quantity_for_map ?? 0}<br/>
        <a href="/sites/${site.site_code}" class="map-popup-link">View record →</a>
      </div>`,
    }))

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

      <OriginDistributionMap kind="mint" color={MINT_ISSUE_COLOR} origin={origin} destinations={destinations} />

      <p className="text-xs text-gray-500">
        <T k={mint ? 'mintDetail.issueDistribution.caption' : 'mintDetail.issueDistribution.captionNoMint'} />
      </p>
    </div>
  )
}
