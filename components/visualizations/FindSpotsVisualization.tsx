'use client'

/**
 * Find Site tab of the map visualizations page: owns all filter state and
 * renders the full-bleed map (FindSpotsMapCanvas, a pure map) with the
 * type/mint filter controls, points/density toggle, and precision controls
 * inside the shared MapVisualizationOverlay, plus a legend overlay.
 *
 * Used by: app/visualizations/find-site/page.tsx.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FindSpotsMapCanvas } from '@/components/map/FindSpotsMapCanvas'
import { MapVisualizationOverlay } from '@/components/visualizations/MapVisualizationOverlay'
import { TypologyFilterBar } from '@/components/visualizations/TypologyFilterBar'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { PrecisionFilter } from '@/lib/city-boundaries'
import {
  NO_DATA_ALPHA,
  NO_DATA_COLOR,
  PRESENT_UNQUANTIFIED_COLOR,
  RAMP_LEGEND_STOPS,
  SINGLE_FIND_COLOR,
  hexToRgba,
} from '@/lib/color-scale'
import { computeSiteHeatStates } from '@/lib/context-heatmap'
import type { FilterMode, SiteHeatState, ViewMode } from '@/lib/context-heatmap'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { buildMintFilterOptions, formatMintOptionLabel, getMatchingCoinTypeCodesByMint } from '@/lib/mint-filter'
import {
  emptyTypologySelection,
  getMatchingCoinTypeCodes,
  hasTypologyFilter,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import type { CoinType, HeatmapFind, MapSite } from '@/lib/types'

const PRECISION_TABS: Array<{ id: PrecisionFilter; key: DictionaryKey }> = [
  { id: 'all', key: 'map.precision.all' },
  { id: 'site', key: 'map.precision.site' },
  { id: 'county', key: 'map.precision.county' },
  { id: 'city', key: 'map.precision.city' },
]

/** Same intensity curve used inside FindSpotsMapCanvas — kept here too since
 * the density point list is computed by this orchestrator. */
function heatIntensity(state: SiteHeatState, site: MapSite): number | null {
  switch (state.kind) {
    case 'no-filter': {
      const qty = site.total_quantity_for_map ?? 0
      if (qty <= 0) return 0.35
      return Math.min(1, 0.35 + Math.log10(qty + 1) / 4)
    }
    case 'no-data':
      return null
    case 'unquantified':
      return 0.4
    case 'pure':
      return 1
    case 'ratio':
      return Math.max(0.08, state.ratio)
  }
}

export function FindSpotsVisualization({
  sites,
  coinTypes,
  finds,
  currentPrecision,
  precisionCounts,
}: {
  sites: MapSite[]
  coinTypes: CoinType[]
  finds: HeatmapFind[]
  /** Precision (site/county/city) links re-fetch sites server-side via
   * searchParams, so the page filters `sites` and hands down only the
   * current value + counts — the links themselves render here. */
  currentPrecision: PrecisionFilter
  precisionCounts: Record<PrecisionFilter, number>
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<FilterMode>('type')
  const [viewMode, setViewMode] = useState<ViewMode>('points')
  const [sel, setSel] = useState<TypologyFilterSelection>(emptyTypologySelection())
  const [mintFilter, setMintFilter] = useState('')
  const [mintSearch, setMintSearch] = useState('')

  const mintOptions = useMemo(() => buildMintFilterOptions(coinTypes), [coinTypes])
  const filteredMints = useMemo(() => {
    const q = mintSearch.trim().toLowerCase()
    if (!q) return mintOptions
    return mintOptions.filter(
      (m) =>
        m.mint_zh.includes(mintSearch.trim()) ||
        (m.mint_en ?? '').toLowerCase().includes(q) ||
        (m.state_zh ?? '').includes(mintSearch.trim()) ||
        (m.state_en ?? '').toLowerCase().includes(q)
    )
  }, [mintOptions, mintSearch])

  const filterActive = mode === 'type' ? hasTypologyFilter(sel) : !!mintFilter

  const matchedCodes = useMemo(() => {
    if (mode === 'mint') return getMatchingCoinTypeCodesByMint(coinTypes, mintFilter)
    return getMatchingCoinTypeCodes(coinTypes, sel)
  }, [mode, coinTypes, mintFilter, sel])

  const siteStates = useMemo(
    () =>
      computeSiteHeatStates(
        sites.map((s) => s.site_code),
        finds,
        matchedCodes
      ),
    [sites, finds, matchedCodes]
  )

  const foundInSummary = useMemo(() => {
    if (!siteStates) return null
    const foundCount = [...siteStates.values()].filter((s) => s.kind !== 'no-data').length
    return { foundCount, totalCount: sites.length }
  }, [siteStates, sites])

  const densityLatLngs = useMemo(() => {
    const points: [number, number, number][] = []
    sites.forEach((site) => {
      if (site.lat == null || site.lng == null) return
      const state: SiteHeatState = siteStates?.get(site.site_code) ?? { kind: 'no-filter' }
      const intensity = heatIntensity(state, site)
      if (intensity == null) return
      points.push([site.lat, site.lng, intensity])
    })
    return points
  }, [sites, siteStates])

  function clearFilters() {
    setSel(emptyTypologySelection())
    setMintFilter('')
    setMintSearch('')
  }

  const precisionButtons = PRECISION_TABS.map((tab) => {
    const isActive = tab.id === currentPrecision
    const href = `/visualizations/find-site${tab.id === 'all' ? '' : `?precision=${tab.id}`}`
    return (
      <Link
        key={tab.id}
        href={href}
        className={`pointer-events-auto rounded border px-2.5 py-1 text-sm font-semibold shadow-sm transition ${
          isActive
            ? 'border-brand bg-brand text-white'
            : 'border-brand/30 bg-white/95 text-brand backdrop-blur-sm hover:bg-brand-light'
        }`}
      >
        <T k={tab.key} /> ({precisionCounts[tab.id]})
      </Link>
    )
  })

  return (
    <div className="absolute inset-0">
      <FindSpotsMapCanvas
        sites={sites}
        mode={mode}
        siteStates={siteStates}
        viewMode={viewMode}
        densityLatLngs={densityLatLngs}
        filterActive={filterActive}
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5 max-h-[calc(100vh-2rem)]
      overflow-y-auto">
          {/* Below `lg` the floating top-right precision bar is hidden (no
              room next to this panel on narrow screens), so it lives here
              instead, inside the same collapsible dropdown. */}
          <div className="flex flex-wrap items-center gap-1.5 lg:hidden">{precisionButtons}</div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['type', 'mint'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  clearFilters()
                }}
                className={`rounded border px-2.5 py-1 text-sm font-semibold transition ${
                  mode === m
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
                }`}
              >
                <T k={m === 'type' ? 'map.filter.byType' : 'map.filter.byMint'} />
              </button>
            ))}
            
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              <T k="map.view.label" />
            </span>
            {(['points', 'density'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className={`rounded border px-2.5 py-1 text-sm font-semibold transition ${
                  viewMode === v
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
                }`}
              >
                <T k={v === 'points' ? 'map.view.points' : 'map.view.density'} />
              </button>
            ))}
          </div>

          <p className="text-sm leading-snug text-gray-700">
            <T k="map.filter.hint" />
          </p>

          {mode === 'type' && (
            <TypologyFilterBar sel={sel} onChange={setSel} showInscriptionList coinTypes={coinTypes} compact />
          )}

          {mode === 'mint' && (
            <div className="flex flex-col gap-2">
              <input
                type="search"
                placeholder={t('map.filter.searchMint')}
                value={mintSearch}
                onChange={(e) => setMintSearch(e.target.value)}
                className="w-full rounded border border-brand/30 px-2.5 py-1.5 text-sm outline-none focus:border-brand"
              />
              <select
                value={mintFilter}
                onChange={(e) => setMintFilter(e.target.value)}
                className="w-full rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="">{t('map.filter.selectMint')}</option>
                {filteredMints.map((m) => (
                  <option key={m.mint_zh} value={m.mint_zh}>
                    {formatMintOptionLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterActive && foundInSummary && (
            <p className="text-sm text-gray-700">
              <T
                k="heatmap.foundIn"
                vars={{ found: foundInSummary.foundCount, total: foundInSummary.totalCount }}
              />
            </p>
          )}
          {filterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto align-right rounded border border-gray-200 px-2.5 py-1 text-sm text-gray-600 hover:border-brand hover:text-brand"
              >
                <T k="heatmap.clearFilter" />
              </button>
            )}
        </div>
      </MapVisualizationOverlay>

      {/* "Site specification" (location precision) — floats as its own
          horizontal button row, top-right, separate from the main filter
          panel so it stays reachable without expanding that panel. Only
          from `lg` up: below that there's no room next to the main panel on
          a narrow screen, so the same buttons render inside it instead. */}
      <div
        className="loc_precision_map hidden lg:flex"
        aria-label={t('map.precision.label')}
      >
        {precisionButtons}
      </div>

      {(filterActive || viewMode === 'density') && (
        <div className="heatmap_legend">
          {filterActive && viewMode === 'points' && (
            <>
              <span className="font-semibold uppercase tracking-wide text-gray-500">
                <T k="map.legend.title" />
              </span>
              {RAMP_LEGEND_STOPS.map((stop) => (
                <span key={stop.ratio} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: stop.color }}
                  />
                  {Math.round(stop.ratio * 100)}%
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: SINGLE_FIND_COLOR }}
                />
                <T k="map.legend.singleFind" />
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: PRESENT_UNQUANTIFIED_COLOR }}
                />
                <T k="heatmap.legend.presentNoCount" />
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA) }}
                />
                <T k="heatmap.legend.noData" />
              </span>
            </>
          )}
          {viewMode === 'density' && (
            <>
              <span className="font-semibold uppercase tracking-wide text-gray-500">
                <T k="map.legend.density" />
              </span>
              <span
                className="inline-block h-2 w-28 rounded-sm"
                style={{
                  background:
                    'linear-gradient(90deg, #f0d56a 0%, #e39a2b 40%, #d04a1c 65%, #a01515 85%, #6e0c0c 100%)',
                }}
              />
              <span className="text-gray-500">
                <T k="map.legend.densityHint" />
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
