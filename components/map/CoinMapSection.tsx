'use client'

/**
 * Thin wrapper around CoinMap for embedding a find-sites map in a page
 * section (with sensible defaults for height/fit-bounds).
 *
 * Used by: app/search/page.tsx (search results map) and
 * app/sites/[site_code]/page.tsx (site detail page's own-site map).
 */

import CoinMap from '@/components/map/CoinMap'
import type { MapSite } from '@/lib/types'

type CoinMapSectionProps = {
  sites: MapSite[]
  height?: string
  fitBounds?: boolean
  highlightSiteCode?: string
  loadingHeight?: string
}

export function CoinMapSection({
  sites,
  height = '480px',
  fitBounds = true,
  highlightSiteCode,
}: CoinMapSectionProps) {
  return (
    <CoinMap
      sites={sites}
      height={height}
      fitBounds={fitBounds}
      highlightSiteCode={highlightSiteCode}
    />
  )
}
