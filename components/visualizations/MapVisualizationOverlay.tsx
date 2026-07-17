'use client'

/**
 * Floating panel overlaid on top of a full-bleed map: the Mint Town / Find
 * Site tabs, that tab's brief description (plus a placeholder slot for a
 * longer write-up — see visualizations.mintTown.detail / findSite.detail in
 * lib/i18n/dictionary.ts), and whatever mode-specific filter controls the
 * caller passes as children. Below the `lg` breakpoint the controls collapse
 * behind a toggle button so the map underneath stays reachable.
 *
 * Used by: MintTownVisualization and FindSpotsVisualization in
 * components/visualizations/MapVisualization.tsx.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

export const VISUALIZATION_TABS: {
  href: string
  labelKey: DictionaryKey
  briefKey: DictionaryKey
  detailKey: DictionaryKey
}[] = [
  {
    href: '/visualizations/mint-town',
    labelKey: 'visualizations.tabs.mintTown',
    briefKey: 'visualizations.mintTown.brief',
    detailKey: 'visualizations.mintTown.detail',
  },
  {
    href: '/visualizations/find-site',
    labelKey: 'visualizations.tabs.findSite',
    briefKey: 'visualizations.findSite.brief',
    detailKey: 'visualizations.findSite.detail',
  },
]

export function MapVisualizationOverlay({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  const active = VISUALIZATION_TABS.find((tab) => pathname.startsWith(tab.href)) ?? VISUALIZATION_TABS[0]
  const detail = t(active.detailKey)

  return (
    <div className="map-vis-overlay ">
      <div className="rounded-lg border border-brand/15 bg-white/95 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3">
          <div className="flex flex-wrap gap-1.5">
            {VISUALIZATION_TABS.map((tab) => {
              const isActive = tab === active
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded border px-2.5 py-1 text-sm font-semibold transition ${
                    isActive
                      ? 'border-brand bg-brand text-white'
                      : 'border-brand/30 bg-white text-brand hover:bg-brand-light'
                  }`}
                >
                  <T k={tab.labelKey} />
                </Link>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Toggle filters"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded border border-brand/30 text-brand lg:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d={open ? 'M2 9L7 4L12 9' : 'M2 5L7 10L12 5'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <p className="px-2.5 pb-2 text-sm text-gray-700 sm:px-3">
          <T k={active.briefKey} />
        </p>

        <div
          className={`${open ? 'block' : 'hidden'} max-h-[min(60dvh,28rem)] overflow-y-auto border-t border-brand/10 px-2.5 py-2.5 sm:px-3 lg:block`}
        >
          {detail && <p className="mb-2.5 text-sm text-gray-700">{detail}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}
