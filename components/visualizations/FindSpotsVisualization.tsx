'use client'

/**
 * Coin Type / Mint tabs of the map visualizations page: owns all filter
 * state and renders the sidebar (FindSpotsSidebar) alongside the map
 * (FindSpotsMapCanvas, a pure map) plus its legend overlay.
 *
 * Used by: app/visualizations/coin-type/page.tsx (forcedMode="type") and
 * app/visualizations/mint/page.tsx (forcedMode="mint").
 */

import { useMemo, useState } from 'react'
import { FindSpotsMapCanvas } from '@/components/map/FindSpotsMapCanvas'
import { FindSpotsSidebar } from '@/components/visualizations/FindSpotsSidebar'
import { T } from '@/components/i18n/T'
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
import { buildMintFilterOptions, getMatchingCoinTypeCodesByMint } from '@/lib/mint-filter'
import {
  emptyTypologySelection,
  getMatchingCoinTypeCodes,
  hasTypologyFilter,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import type { CoinType, HeatmapFind, MapSite } from '@/lib/types'

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
  height = '100%',
  forcedMode,
}: {
  sites: MapSite[]
  coinTypes: CoinType[]
  finds: HeatmapFind[]
  height?: string
  /** Lock the type/mint filter mode and hide the toggle — for pages (like the
   * Coin Type / Mint tabs of the map visualizations page) that already convey
   * the mode via their own navigation. */
  forcedMode?: FilterMode
}) {
  const [mode, setMode] = useState<FilterMode>(forcedMode ?? 'type')
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

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col bg-white lg:flex-row min-[1440px]:min-h-0 min-[1440px]:overflow-hidden">
      {/* Filters: top strip on mobile, left sidebar on desktop. Below 1440px
          the page is allowed to scroll (see app/visualizations/*), so the
          aside shows its full content instead of being height-capped. */}
      <aside className="flex shrink-0 flex-col border-b border-brand/20 lg:w-[19.5rem] lg:border-b-0 lg:border-r xl:w-[22rem]">
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5 sm:px-3.5">
          <FindSpotsSidebar
            mode={mode}
            onModeChange={(m) => {
              setMode(m)
              clearFilters()
            }}
            forcedMode={forcedMode}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filterActive={filterActive}
            onClearFilters={clearFilters}
            sel={sel}
            onSelChange={setSel}
            coinTypes={coinTypes}
            mintSearch={mintSearch}
            onMintSearchChange={setMintSearch}
            mintFilter={mintFilter}
            onMintFilterChange={setMintFilter}
            filteredMints={filteredMints}
            foundInSummary={foundInSummary}
          />
        </div>
      </aside>

      {/* Map canvas — dominant area */}
      <div className="relative flex-1">
        <FindSpotsMapCanvas
          sites={sites}
          mode={mode}
          siteStates={siteStates}
          viewMode={viewMode}
          densityLatLngs={densityLatLngs}
          filterActive={filterActive}
          height={height}
        />

        {(filterActive || viewMode === 'density') && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-white/90 px-2.5 py-1.5 text-[11px] text-gray-600 shadow-sm backdrop-blur-sm sm:right-auto sm:max-w-[min(100%-1.5rem,36rem)]">
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
    </div>
  )
}
