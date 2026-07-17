'use client'

/**
 * Both tabs of the map visualizations page: FindSpotsVisualization (Find Site
 * tab) and MintTownVisualization (Mint Town tab). Each owns its own filter
 * state and data shape, but both render the full-bleed map (MapVisCanvas)
 * inside the same MapVisualizationOverlay, with a matching filter-panel shell
 * (mode/source toggle row, points/density toggle, hint text, legend) built
 * from the shared pieces below — only the legend contents and the map's
 * point-rendering logic (color-coded find-site dots vs. sized mint circles)
 * differ, and that difference lives in MapVisCanvas itself.
 *
 * Used by: app/visualizations/find-site/page.tsx and
 * app/visualizations/mint-town/page.tsx.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { MapVisCanvas } from '@/components/map/MapVisCanvas'
import { MapVisualizationOverlay } from '@/components/visualizations/MapVisualizationOverlay'
import { TypologyFilterBar } from '@/components/visualizations/TypologyFilterBar'
import { T } from '@/components/i18n/T'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
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
import { getMintByNameZh } from '@/lib/mint-towns'
import { computeMintStatsFromFinds, toMintPoints, type HeatmapSource } from '@/lib/pointed-spade-data'
import {
  emptyTypologySelection,
  getInscriptionEntries,
  getMatchingCoinTypeCodes,
  hasTypologyFilter,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import type { CoinType, HeatmapFind, MapSite } from '@/lib/types'

/* ── shared filter-panel pieces ─────────────────────────────────────────── */

function ToggleButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded border px-2.5 py-1 text-sm font-semibold transition ${
            value === opt.value
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ViewModeRow({ viewMode, onChange }: { viewMode: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-semibold text-gray-700">
        <T k="map.view.label" />
      </span>
      <ToggleButtons
        value={viewMode}
        onChange={onChange}
        options={[
          { value: 'points', label: <T k="map.view.points" /> },
          { value: 'density', label: <T k="map.view.density" /> },
        ]}
      />
    </div>
  )
}

/** How size (and, in Density view, heat weight) is calculated — shown in the
 * filter panel itself (distinct from DensityLegend's terse one-liner in the
 * floating bottom legend), same text for both tabs since the underlying
 * calculation (siteSizeByQuantity / heatIntensity) is shared. */
function SizeCalcHint({ viewMode }: { viewMode: ViewMode }) {
  return (
    <p className="text-sm leading-snug text-gray-700">
      <T k={viewMode === 'density' ? 'map.filter.densityHint' : 'map.filter.sizeHint'} />
    </p>
  )
}

function DensityLegend() {
  return (
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
  )
}

/* ── Find Site tab ───────────────────────────────────────────────────────── */

const PRECISION_TABS: Array<{ id: PrecisionFilter; key: DictionaryKey }> = [
  { id: 'all', key: 'search.precision.all' },
  { id: 'site', key: 'search.precision.site' },
  { id: 'county', key: 'search.precision.county' },
  { id: 'city', key: 'search.precision.city' },
]

/** Same intensity curve used for both Find Site and Mint Town density mode —
 * shared here since the density point list is computed by this orchestrator
 * for both tabs. */
function heatIntensity(state: SiteHeatState, totalQty: number): number | null {
  switch (state.kind) {
    case 'no-filter': {
      if (totalQty <= 0) return 0.35
      return Math.min(1, 0.35 + Math.log10(totalQty + 1) / 4)
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

  const mintOptions = useMemo(() => buildMintFilterOptions(coinTypes), [coinTypes])
  const mintSelectOptions = useMemo(
    () =>
      mintOptions.map((m) => ({
        value: m.mint_zh,
        label: formatMintOptionLabel(m),
        searchText: `${m.mint_zh} ${m.mint_en ?? ''} ${m.state_zh ?? ''} ${m.state_en ?? ''}`,
      })),
    [mintOptions]
  )

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
      const intensity = heatIntensity(state, site.total_quantity_for_map ?? 0)
      if (intensity == null) return
      points.push([site.lat, site.lng, intensity])
    })
    return points
  }, [sites, siteStates])

  // Filtering by a specific mint: plot that mint town's own location too,
  // when we know where it is.
  const highlightMint = useMemo(() => {
    if (mode !== 'mint' || !mintFilter) return null
    const town = getMintByNameZh(mintFilter)
    if (town?.lat == null || town?.lng == null) return null
    return {
      mint_zh: town.name_zh,
      mint_en: town.name_en ?? null,
      mint_code: town.mint_code ?? null,
      modern_location_en: town.modern_location_en ?? null,
      lat: town.lat,
      lng: town.lng,
    }
  }, [mode, mintFilter])

  function clearFilters() {
    setSel(emptyTypologySelection())
    setMintFilter('')
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
      <MapVisCanvas
        kind="sites"
        sites={sites}
        mode={mode}
        siteStates={siteStates}
        viewMode={viewMode}
        densityLatLngs={densityLatLngs}
        filterActive={filterActive}
        highlightMint={highlightMint}
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5 max-h-[calc(100vh-2rem)]
      overflow-y-auto">
          {/* Below `lg` the floating top-right precision bar is hidden (no
              room next to this panel on narrow screens), so it lives here
              instead, inside the same collapsible dropdown. */}
          <div className="flex flex-wrap items-center gap-1.5 lg:hidden">{precisionButtons}</div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              <T k="map.filter.modeLabel" />
            </span>
            <ToggleButtons
              value={mode}
              onChange={(m) => {
                setMode(m)
                clearFilters()
              }}
              options={[
                { value: 'type' as const, label: <T k="map.filter.byType" /> },
                { value: 'mint' as const, label: <T k="map.filter.byMint" /> },
              ]}
            />
          </div>

          <ViewModeRow viewMode={viewMode} onChange={setViewMode} />

          <p className="text-sm leading-snug text-gray-700">
            <T k="map.filter.hint" />
          </p>
          <SizeCalcHint viewMode={viewMode} />

          {mode === 'type' && (
            <TypologyFilterBar sel={sel} onChange={setSel} showInscriptionList coinTypes={coinTypes} compact />
          )}

          {mode === 'mint' && (
            <SearchableSelect
              options={mintSelectOptions}
              value={mintFilter}
              onChange={setMintFilter}
              placeholder={t('map.filter.searchMint')}
              noResultsLabel={t('map.filter.noMintMatches')}
            />
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded border border-brand/30 bg-brand-light px-2.5 py-1 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
              >
                <T k="heatmap.clearFilter" />
              </button>
            </div>
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
        aria-label={t('search.precision.label')}
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
          {viewMode === 'density' && <DensityLegend />}
        </div>
      )}
    </div>
  )
}

/* ── Mint Town tab ───────────────────────────────────────────────────────── */

export function MintTownVisualization({
  finds,
  coinTypes,
}: {
  finds: HeatmapFind[]
  coinTypes: CoinType[]
}) {
  // Only one data source exists today (database finds) — the toggle row is
  // kept (rather than collapsed away) so a future data source is just
  // another entry in `options` below, not a UI rebuild.
  const [source, setSource] = useState<HeatmapSource>('database')
  const [viewMode, setViewMode] = useState<ViewMode>('points')
  const [sel, setSel] = useState<TypologyFilterSelection>(emptyTypologySelection())

  const filterActive = hasTypologyFilter(sel)

  const matchedCodes = useMemo(() => getMatchingCoinTypeCodes(coinTypes, sel), [coinTypes, sel])

  // Every known mint town's full totals, regardless of the active filter —
  // this is both the plotted point list (always complete, like Find Site's
  // site list) and the "typical information" source for popups.
  const totalStats = useMemo(() => computeMintStatsFromFinds(finds, coinTypes, null), [finds, coinTypes])
  // The same aggregation narrowed to the active filter, used only to read
  // off each mint's matched coin count.
  const matchedStats = useMemo(
    () => computeMintStatsFromFinds(finds, coinTypes, matchedCodes),
    [finds, coinTypes, matchedCodes]
  )

  const mintPoints = useMemo(() => toMintPoints(totalStats.mapped), [totalStats])

  // Per-mint heat state: the percentage of a mint's coins that are the
  // selected type, out of its total coins — same "matched vs. total" ratio
  // concept as Find Site's per-site heat state, just aggregated over the
  // whole mint instead of per find-context.
  const mintStates = useMemo(() => {
    if (!matchedCodes) return null
    const matchedByMint = new Map(matchedStats.mapped.map((m) => [m.mint_zh, m.coinCount]))
    const states = new Map<string, SiteHeatState>()
    totalStats.mapped.forEach((mint) => {
      const total = mint.coinCount
      const matched = matchedByMint.get(mint.mint_zh) ?? 0
      if (total <= 0) {
        states.set(mint.mint_zh, { kind: 'no-data' })
        return
      }
      if (matched >= total) {
        states.set(mint.mint_zh, { kind: 'pure' })
        return
      }
      states.set(mint.mint_zh, {
        kind: 'ratio',
        ratio: matched / total,
        matchedQty: matched,
        totalQty: total,
        contextCount: 1,
      })
    })
    return states
  }, [matchedCodes, matchedStats, totalStats])

  // When the filter narrows to one specific inscription, that inscription
  // resolves to one known mint (via the typology data's mint_zh field) —
  // plot it as an extra, distinct point when we know where it is.
  const highlightMint = useMemo(() => {
    if (source !== 'database' || !sel.inscription) return null
    const entry = getInscriptionEntries(sel).find((e) => e.inscription_zh === sel.inscription)
    const mintZh = entry?.mint_zh?.trim()
    if (!mintZh) return null
    const town = getMintByNameZh(mintZh)
    if (town?.lat == null || town?.lng == null) return null
    return {
      mint_zh: mintZh,
      mint_en: town.name_en ?? null,
      mint_code: town.mint_code ?? null,
      modern_location_en: town.modern_location_en ?? null,
      lat: town.lat,
      lng: town.lng,
    }
  }, [source, sel])

  const densityLatLngs = useMemo(() => {
    const points: [number, number, number][] = []
    mintPoints.forEach((mint) => {
      const state: SiteHeatState = mintStates?.get(mint.mint_zh) ?? { kind: 'no-filter' }
      const intensity = heatIntensity(state, mint.totalQty)
      if (intensity == null) return
      points.push([mint.lat, mint.lng, intensity])
    })
    return points
  }, [mintPoints, mintStates])

  const foundInSummary = useMemo(() => {
    if (!mintStates) return null
    const foundCount = [...mintStates.values()].filter((s) => s.kind !== 'no-data').length
    return { foundCount, totalCount: mintPoints.length }
  }, [mintStates, mintPoints])

  function clearFilters() {
    setSel(emptyTypologySelection())
  }

  return (
    <div className="absolute inset-0">
      <MapVisCanvas
        kind="mints"
        mintPoints={mintPoints}
        mintStates={mintStates}
        viewMode={viewMode}
        densityLatLngs={densityLatLngs}
        highlightMint={highlightMint}
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              <T k="visualizations.data.label" />
            </span>
            <ToggleButtons
              value={source}
              onChange={setSource}
              options={[{ value: 'database' as const, label: <T k="visualizations.data.database" /> }]}
            />
          </div>

          <ViewModeRow viewMode={viewMode} onChange={setViewMode} />

          <p className="text-sm leading-snug text-gray-700">
            <T k="visualizations.mintHeatmapCaption.database" />
          </p>

          <p className="text-sm leading-snug text-gray-700">
            <T k="map.filter.hintMintTown" />
          </p>
          <SizeCalcHint viewMode={viewMode} />
          <TypologyFilterBar sel={sel} onChange={setSel} showInscriptionList coinTypes={coinTypes} compact />

          {mintPoints.length === 0 && (
            <p className="text-sm text-gray-700">
              <T k="visualizations.noMappedMints" />
            </p>
          )}

          {filterActive && foundInSummary && (
            <p className="text-sm text-gray-700">
              <T
                k="heatmap.foundInMints"
                vars={{ found: foundInSummary.foundCount, total: foundInSummary.totalCount }}
              />
            </p>
          )}
          {filterActive && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded border border-brand/30 bg-brand-light px-2.5 py-1 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
              >
                <T k="heatmap.clearFilter" />
              </button>
            </div>
          )}
        </div>
      </MapVisualizationOverlay>

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
                  style={{ background: hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA) }}
                />
                <T k="heatmap.legend.noData" />
              </span>
            </>
          )}
          {viewMode === 'density' && <DensityLegend />}
        </div>
      )}
    </div>
  )
}
