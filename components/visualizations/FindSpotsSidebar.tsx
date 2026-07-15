'use client'

/**
 * Sidebar for the Coin Type / Mint tabs of the map visualizations page: the
 * "Visualize by" tabs, a points/density-mass view toggle, the type/mint
 * filter controls, and a match summary. Pure formatting/controls — the
 * actual map lives in components/map/FindSpotsMapCanvas.tsx.
 *
 * Used by: components/visualizations/FindSpotsVisualization.tsx
 * (app/visualizations/coin-type and app/visualizations/mint pages).
 */

import { TypologyFilterBar } from '@/components/visualizations/TypologyFilterBar'
import { VisualizationTabs } from '@/components/visualizations/VisualizationTabs'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { FilterMode, ViewMode } from '@/lib/context-heatmap'
import type { MintFilterOption } from '@/lib/mint-filter'
import { formatMintOptionLabel } from '@/lib/mint-filter'
import type { TypologyFilterSelection } from '@/lib/typology-filter'
import type { CoinType } from '@/lib/types'

export function FindSpotsSidebar({
  mode,
  onModeChange,
  forcedMode,
  viewMode,
  onViewModeChange,
  filterActive,
  onClearFilters,
  sel,
  onSelChange,
  coinTypes,
  mintSearch,
  onMintSearchChange,
  mintFilter,
  onMintFilterChange,
  filteredMints,
  foundInSummary,
}: {
  mode: FilterMode
  onModeChange: (mode: FilterMode) => void
  forcedMode?: FilterMode
  viewMode: ViewMode
  onViewModeChange: (viewMode: ViewMode) => void
  filterActive: boolean
  onClearFilters: () => void
  sel: TypologyFilterSelection
  onSelChange: (sel: TypologyFilterSelection) => void
  coinTypes: CoinType[]
  mintSearch: string
  onMintSearchChange: (value: string) => void
  mintFilter: string
  onMintFilterChange: (value: string) => void
  filteredMints: MintFilterOption[]
  foundInSummary: { foundCount: number; totalCount: number } | null
}) {
  const { t } = useLanguage()

  return (
    <>
      <div key="tabs">
        <VisualizationTabs />
      </div>

      <div key="display-toggle" className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <T k="map.view.label" />
        </span>
        {(['points', 'density'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewModeChange(v)}
            className={`px-2 py-0.5 text-[11px] font-semibold border transition ${
              viewMode === v
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
            }`}
          >
            <T k={v === 'points' ? 'map.view.points' : 'map.view.density'} />
          </button>
        ))}
      </div>

      <p key="hint" className="text-[11px] leading-snug text-gray-500">
        <T k="map.filter.hint" />
      </p>

      {(!forcedMode || filterActive) && (
        <div key="mode-toggle" className="flex flex-wrap items-center gap-1">
          {!forcedMode &&
            (['type', 'mint'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`px-2.5 py-1 text-[11px] font-semibold border transition ${
                  mode === m
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
                }`}
              >
                <T k={m === 'type' ? 'map.filter.byType' : 'map.filter.byMint'} />
              </button>
            ))}
          {filterActive && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-auto px-2 py-1 text-[11px] text-gray-500 hover:text-brand border border-gray-200 hover:border-brand"
            >
              <T k="heatmap.clearFilter" />
            </button>
          )}
        </div>
      )}

      {mode === 'type' && (
        <TypologyFilterBar
          key="type-filter"
          sel={sel}
          onChange={onSelChange}
          showInscriptionList
          coinTypes={coinTypes}
          compact
        />
      )}

      {mode === 'mint' && (
        <div key="mint-filter" className="flex flex-col gap-2 text-sm">
          <input
            type="search"
            placeholder={t('map.filter.searchMint')}
            value={mintSearch}
            onChange={(e) => onMintSearchChange(e.target.value)}
            className="w-full rounded border border-brand/30 px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          <select
            value={mintFilter}
            onChange={(e) => onMintFilterChange(e.target.value)}
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
        <p key="found-in" className="text-xs text-gray-700">
          <T
            k="heatmap.foundIn"
            vars={{ found: foundInSummary.foundCount, total: foundInSummary.totalCount }}
          />
        </p>
      )}
    </>
  )
}
