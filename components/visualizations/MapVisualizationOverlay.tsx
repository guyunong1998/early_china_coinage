'use client'

/**
 * Floating panel overlaid on top of a full-bleed map: the Mint Town / Find
 * Site tabs, that tab's brief description (plus a placeholder slot for a
 * longer write-up — see visualizations.mintTown.detail / findSite.detail in
 * lib/i18n/dictionary.ts), and whatever mode-specific filter controls the
 * caller passes as children. The controls collapse behind a toggle button
 * at every breakpoint (including desktop, where the panel otherwise
 * stretches to the map box's full height) so the map underneath stays
 * reachable.
 *
 * Used by: MintTownVisualization and FindSpotsVisualization in
 * components/visualizations/MapVisualization.tsx.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { T } from '@/components/i18n/T'
import { ClickHint } from '@/components/ui/ClickHint'
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

// Mint Town and Find Site are separate routes, so switching tabs unmounts
// and remounts this component — a plain useState default would reset the
// panel closed every time. Mirroring the open/closed state into this
// module-level variable (read only as the next mount's initial value)
// makes it survive that remount within the same client session.
let lastOpenState = false

// Desktop has room for the panel to sit open by default (unlike mobile/
// tablet, where it starts collapsed so the map stays reachable). Applied
// once per client session — not in the initial useState (that would
// mismatch the server-rendered "closed" HTML) and guarded so a later tab
// switch (which remounts this component) doesn't re-open a panel the user
// already explicitly collapsed.
let appliedDesktopDefault = false

export function MapVisualizationOverlay({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [open, setOpenState] = useState(lastOpenState)

  function setOpen(value: boolean | ((prev: boolean) => boolean)) {
    setOpenState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      lastOpenState = next
      return next
    })
  }

  useEffect(() => {
    if (appliedDesktopDefault) return
    appliedDesktopDefault = true
    if (window.matchMedia('(min-width: 1024px)').matches) setOpen(true)
  }, [])

  const active = VISUALIZATION_TABS.find((tab) => pathname.startsWith(tab.href)) ?? VISUALIZATION_TABS[0]
  const detail = t(active.detailKey)

  return (
    <div className={`map-vis-overlay ${open ? '' : 'map-vis-overlay-collapsed'}`}>
      <div className="map-vis-panel">
        <div className="map-vis-panel-header">
          <ClickHint hint={t('visualizations.viewByLabelHint')} className="shrink-0 hint-underline text-sm font-semibold text-gray-700">
            <T k="visualizations.viewByLabel" />
          </ClickHint>

          <div className={`map-vis-tabs ${open ? 'flex' : 'hidden'}`}>
            {VISUALIZATION_TABS.map((tab) => {
              const isActive = tab === active
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`large-pill rounded px-2.5 py-1 text-sm font-semibold transition ${isActive ? 'large-pill-active' : 'large-pill-inactive'}`}
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
            aria-label={t('ui.toggleFilters')}
            className="map-vis-panel-toggle"
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

        <p className={`map-vis-brief ${open ? 'block' : 'hidden'}`}>
          <T k={active.briefKey} />
        </p>

        <div className={`map-vis-panel-body ${open ? 'block' : 'hidden'}`}>
          {detail && <p className="mb-2.5 text-sm text-gray-700">{detail}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}
