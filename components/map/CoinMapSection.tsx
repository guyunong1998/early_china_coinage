'use client'

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
