'use client'

/**
 * Mint town page's "Issued Coin Distribution" section: a coin-type filter
 * dropdown, the find-sites map (MintIssueDistributionMapCanvas, a pure map),
 * and a caption below it.
 *
 * Used by: app/mints/[mint_code]/page.tsx.
 */

import { useMemo, useState } from 'react'
import { MintIssueDistributionMapCanvas } from '@/components/map/MintIssueDistributionMapCanvas'
import type { MapSite } from '@/lib/types'
import type { MintTypeOption } from '@/lib/queries'

type MintIssueDistributionProps = {
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

export function MintIssueDistribution({ mint, sites, siteTypeKeys, typeOptions }: MintIssueDistributionProps) {
  const [selectedType, setSelectedType] = useState('all')

  const filteredSites = useMemo(() => {
    if (selectedType === 'all') return sites
    return sites.filter((site) => (siteTypeKeys[site.site_code] ?? []).includes(selectedType))
  }, [selectedType, sites, siteTypeKeys])

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

      <MintIssueDistributionMapCanvas mint={mint} sites={filteredSites} />

      <p className="text-xs text-gray-500">
        Red marker: mint location. Teal markers: findspots containing coins issued by this mint.
      </p>
    </div>
  )
}
