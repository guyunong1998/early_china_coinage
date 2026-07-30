'use client'

/**
 * Route-level loading fallback for the map pages (app/visualizations/
 * find-site/loading.tsx, app/visualizations/mint-town/loading.tsx) — Next.js
 * swaps this in automatically while the page's server-side data fetch
 * (sites/coin issues/finds) is in flight. Picked once per mount, not
 * re-rolled on every render, so the coin doesn't flicker while this is on
 * screen.
 */

import Image from 'next/image'
import { useState } from 'react'
import { T } from '@/components/i18n/T'
import { pickRandomLoadingCoinType } from '@/lib/loading-coin-types'

export function MapLoadingOverlay() {
  const [coin] = useState(pickRandomLoadingCoinType)

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="panel flex flex-col items-center gap-4 rounded-lg px-8 py-7 shadow-lg">
        <div className="relative h-32 w-32 overflow-hidden rounded border border-gray-200 bg-white">
          <Image
            src={coin.src}
            alt={coin.label_en}
            fill
            sizes="128px"
            className="object-contain"
            priority
          />
        </div>

        <p className="text-center font-serif text-sm font-semibold text-gray-900">
          {coin.label_zh} <span className="font-normal text-gray-500">({coin.label_en})</span>
        </p>

        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          <T k="map.loading" />
        </div>
      </div>
    </div>
  )
}
