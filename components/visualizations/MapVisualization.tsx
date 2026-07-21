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
import { MapVisCanvas, type ComparePoint, type PinPoint } from '@/components/map/MapVisCanvas'
import { AccessionNumberSearch } from '@/components/museum/AccessionNumberSearch'
import { MapVisualizationOverlay } from '@/components/visualizations/MapVisualizationOverlay'
import { TypologyFilterBar } from '@/components/visualizations/TypologyFilterBar'
import { T } from '@/components/i18n/T'
import { MultiSelectSearch } from '@/components/ui/MultiSelectSearch'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { PrecisionFilter } from '@/lib/city-boundaries'
import {
  NO_DATA_ALPHA,
  NO_DATA_COLOR,
  PRESENT_UNQUANTIFIED_COLOR,
  RAMP_LEGEND_STOPS,
  SELECTION_COLORS,
  SINGLE_FIND_COLOR,
  hexToRgba,
  useSelectionColors,
} from '@/lib/color-scale'
import { computeSiteHeatStates } from '@/lib/context-heatmap'
import type { FilterMode, SiteHeatState, ViewMode } from '@/lib/context-heatmap'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import {
  buildMintFilterOptions,
  computeSiteMintQuantities,
  formatMintOptionLabel,
  getMatchingCoinIssueIdsByMints,
  type MintFilterOption,
} from '@/lib/mint-filter'
import { getMintByNameZh } from '@/lib/mint-towns'
import {
  ansCollectionUrl,
  computeAnsMintStats,
  computeMintStatsFromFinds,
  getMatchingAnsSpecimens,
  toMintPoints,
  type AnsSpecimen,
  type HeatmapSource,
} from '@/lib/pointed-spade-data'
import {
  emptyTypologySelection,
  getMatchingCoinIssueIds,
  hasTypologyFilter,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import type { CoinIssueDisplay, CoinTypeHierarchyRow, HeatmapFind, MapSite } from '@/lib/types'

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

function ViewModeRow({
  viewMode,
  onChange,
  showCompare = false,
}: {
  viewMode: ViewMode
  onChange: (v: ViewMode) => void
  /** Compare only makes sense once mints are being multiselected (Find
   * Site's "by mint" filter mode) — every other caller leaves this off. */
  showCompare?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-semibold text-gray-700">
        <T k="map.view.label" />
      </span>
      <ToggleButtons
        value={viewMode}
        onChange={onChange}
        options={[
          { value: 'points' as const, label: <T k="map.view.points" /> },
          { value: 'density' as const, label: <T k="map.view.density" /> },
          ...(showCompare ? [{ value: 'compare' as const, label: <T k="map.view.compare" /> }] : []),
        ]}
      />
    </div>
  )
}

/**
 * Paragraph 2 of every map's explanation: how to read the current view mode
 * (color + size mechanics), identical wording wherever that view mode
 * appears — Find Site, the database Mint Town tab, and Museum Collections'
 * Mint Town tab all render the exact same points/density/compare text here,
 * distinct from DensityLegend's terse one-liner in the floating bottom
 * legend. Paragraph 1 (what's currently filtered) lives beside this at each
 * call site, since its wording is specific to that map.
 */
function MapExplanation({ viewMode }: { viewMode: ViewMode }) {
  const key = viewMode === 'density' ? 'map.explain.density' : viewMode === 'compare' ? 'map.explain.compare' : 'map.explain.points'
  return (
    <p className="text-xs leading-snug text-gray-500">
      <T k={key} />
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

/** Compare view's legend — one swatch per selected mint, same identity
 * colors (by stable slot, not array position) as its chip in the multiselect
 * list and its points on the map. */
function CompareLegend({
  mintFilters,
  mintOptions,
  mintColorByValue,
}: {
  mintFilters: string[]
  mintOptions: MintFilterOption[]
  mintColorByValue: Map<string, string>
}) {
  return (
    <>
      <span className="font-semibold uppercase tracking-wide text-gray-500">
        <T k="map.legend.byMint" />
      </span>
      {mintFilters.map((mintId) => {
        const opt = mintOptions.find((m) => m.mint_id === mintId)
        return (
          <span key={mintId} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: mintColorByValue.get(mintId) }}
            />
            {opt?.mint_zh ?? mintId}
          </span>
        )
      })}
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
  coinIssues,
  hierarchyRows,
  finds,
  currentPrecision,
  precisionCounts,
}: {
  sites: MapSite[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
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
  // Order of selection (not of `mintOptions`) so each pick keeps its color
  // slot — and pin color — as later picks are added/removed around it.
  const { selected: mintFilters, colorByValue: mintColorByValue, toggle: toggleMintFilter, clear: clearMintFilters } =
    useSelectionColors()

  const mintOptions = useMemo(() => buildMintFilterOptions(coinIssues, finds), [coinIssues, finds])
  const mintSelectOptions = useMemo(
    () =>
      mintOptions.map((m) => ({
        value: m.mint_id,
        label: formatMintOptionLabel(m),
        searchText: `${m.mint_zh} ${m.mint_en ?? ''} ${m.state_zh ?? ''} ${m.state_en ?? ''}`,
        muted: !m.hasCoordinates,
        mutedHint: m.hasCoordinates ? undefined : t('map.filter.noMapCoords'),
      })),
    [mintOptions, t]
  )

  const mintFilterSet = useMemo(() => new Set(mintFilters), [mintFilters])

  const filterActive = mode === 'type' ? hasTypologyFilter(sel) : mintFilters.length > 0

  const matchedIds = useMemo(() => {
    if (mode === 'mint') return getMatchingCoinIssueIdsByMints(coinIssues, mintFilters)
    return getMatchingCoinIssueIds(coinIssues, hierarchyRows, sel)
  }, [mode, coinIssues, hierarchyRows, mintFilters, sel])

  const siteStates = useMemo(
    () =>
      computeSiteHeatStates(
        sites.map((s) => s.site_code),
        finds,
        matchedIds
      ),
    [sites, finds, matchedIds]
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

  // Filtering by mint: plot each selected mint town's own location too, one
  // dropped pin per selection (colored to match its chip in the multiselect
  // list), when we know where it is.
  const pins = useMemo<PinPoint[]>(() => {
    if (mode !== 'mint') return []
    return mintFilters.flatMap((mintId) => {
      const opt = mintOptions.find((m) => m.mint_id === mintId)
      const town = opt?.mint_zh ? getMintByNameZh(opt.mint_zh) : undefined
      if (town?.lat == null || town?.lng == null) return []
      return [
        {
          key: mintId,
          lat: town.lat,
          lng: town.lng,
          color: mintColorByValue.get(mintId) ?? SELECTION_COLORS[0],
          label: `${town.name_zh}${town.name_en ? ` (${town.name_en})` : ''}`,
          href: town.mint_code ? `/mints/${town.mint_code}` : undefined,
        },
      ]
    })
  }, [mode, mintFilters, mintOptions, mintColorByValue])

  // Compare view: one point per (site, mint) that has a nonzero quantity
  // for that mint, colored by the mint's identity color — unlike
  // points/density (which OR the selection into one match-ratio per site),
  // a site with coins from two selected mints shows up twice here.
  const siteMintQuantities = useMemo(() => {
    if (mode !== 'mint' || viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeSiteMintQuantities(finds, coinIssues, mintFilters)
  }, [mode, viewMode, finds, coinIssues, mintFilters])

  const comparePoints = useMemo<ComparePoint[]>(() => {
    if (mode !== 'mint' || viewMode !== 'compare') return []
    const sitesByCode = new Map(sites.map((s) => [s.site_code, s]))
    const points: ComparePoint[] = []
    mintFilters.forEach((mintId) => {
      const opt = mintOptions.find((m) => m.mint_id === mintId)
      const color = mintColorByValue.get(mintId) ?? SELECTION_COLORS[0]
      siteMintQuantities.forEach((byMint, siteCode) => {
        const qty = byMint.get(mintId)
        if (!qty) return
        const site = sitesByCode.get(siteCode)
        if (site?.lat == null || site?.lng == null) return
        points.push({
          key: `${siteCode}::${mintId}`,
          siteCode,
          lat: site.lat,
          lng: site.lng,
          color,
          qty,
          siteLabel: site.site_name_zh ?? siteCode,
          mintLabel: opt ? formatMintOptionLabel(opt) : mintId,
          href: `/sites/${siteCode}`,
        })
      })
    })
    return points
  }, [mode, viewMode, mintFilters, mintOptions, mintColorByValue, siteMintQuantities, sites])

  function clearFilters() {
    setSel(emptyTypologySelection())
    clearMintFilters()
  }

  const precisionButtons = PRECISION_TABS.map((tab) => {
    const isActive = tab.id === currentPrecision
    const href = `/visualizations/find-site${tab.id === 'all' ? '' : `?precision=${tab.id}`}`
    return (
      <Link
        key={tab.id}
        href={href}
        className={`pointer-events-auto shrink-0 whitespace-nowrap rounded border px-2.5 py-1 text-sm font-semibold shadow-sm transition ${
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
        pins={pins}
        comparePoints={comparePoints}
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5">
          {/* Below `lg` the floating top-right precision bar is hidden (no
              room next to this panel on narrow screens), so it lives here
              instead, inside the same collapsible dropdown. */}
          <div className="loc_precision_map-m flex items-center gap-1.5 lg:hidden">{precisionButtons}</div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              <T k="map.filter.modeLabel" />
            </span>
            <ToggleButtons
              value={mode}
              onChange={(m) => {
                setMode(m)
                clearFilters()
                // Compare only exists under "by mint" — leaving it stranded
                // in Compare with no mint filter control visible would just
                // show an empty map.
                if (m !== 'mint' && viewMode === 'compare') setViewMode('points')
              }}
              options={[
                { value: 'type' as const, label: <T k="map.filter.byType" /> },
                { value: 'mint' as const, label: <T k="map.filter.byMint" /> },
              ]}
            />
          </div>

          <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare={mode === 'mint'} />

          <p className="text-sm leading-snug text-gray-700">
            {mode === 'type' ? (
              <T k={filterActive ? 'map.currentView.typeActive' : 'map.currentView.typeNone'} />
            ) : mintFilters.length === 0 ? (
              <T k="map.currentView.mintNone" />
            ) : (
              <T k={viewMode === 'compare' ? 'map.currentView.mintActiveCompare' : 'map.currentView.mintActiveOr'} />
            )}
          </p>
          <MapExplanation viewMode={viewMode} />

          {mode === 'type' && (
            <TypologyFilterBar
              sel={sel}
              onChange={setSel}
              showInscriptionList
              hierarchyRows={hierarchyRows}
              coinIssues={coinIssues}
              compact
            />
          )}

          {mode === 'mint' && (
            <MultiSelectSearch
              options={mintSelectOptions}
              selectedKeys={mintFilterSet}
              colorByValue={mintColorByValue}
              onToggle={toggleMintFilter}
              onClear={clearMintFilters}
              placeholder={t('map.filter.searchMint')}
              noResultsLabel={t('map.filter.noMintMatches')}
              selectedCountLabel={(count) => t('ui.selectedCount', { count })}
              clearLabel={t('ui.clear')}
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

      {(filterActive || viewMode === 'density' || viewMode === 'compare') && (
        <div className="heatmap_legend">
          {viewMode === 'compare' && (
            <CompareLegend mintFilters={mintFilters} mintOptions={mintOptions} mintColorByValue={mintColorByValue} />
          )}
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
  coinIssues,
  hierarchyRows,
}: {
  finds: HeatmapFind[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
}) {
  // Only one data source exists today (database finds) — the toggle row is
  // kept (rather than collapsed away) so a future data source is just
  // another entry in `options` below, not a UI rebuild.
  const [source, setSource] = useState<HeatmapSource>('database')
  const [viewMode, setViewMode] = useState<ViewMode>('points')
  const [sel, setSel] = useState<TypologyFilterSelection>(emptyTypologySelection())

  const filterActive = hasTypologyFilter(sel)

  const matchedIds = useMemo(
    () => getMatchingCoinIssueIds(coinIssues, hierarchyRows, sel),
    [coinIssues, hierarchyRows, sel]
  )

  // Every known mint town's full totals, regardless of the active filter —
  // this is both the plotted point list (always complete, like Find Site's
  // site list) and the "typical information" source for popups.
  const totalStats = useMemo(() => computeMintStatsFromFinds(finds, coinIssues, null), [finds, coinIssues])
  // The same aggregation narrowed to the active filter, used only to read
  // off each mint's matched coin count.
  const matchedStats = useMemo(
    () => computeMintStatsFromFinds(finds, coinIssues, matchedIds),
    [finds, coinIssues, matchedIds]
  )

  const mintPoints = useMemo(() => toMintPoints(totalStats.mapped), [totalStats])

  // Per-mint heat state: the percentage of a mint's coins that are the
  // selected type, out of its total coins — same "matched vs. total" ratio
  // concept as Find Site's per-site heat state, just aggregated over the
  // whole mint instead of per find-context.
  const mintStates = useMemo(() => {
    if (!matchedIds) return null
    const matchedByMint = new Map(matchedStats.mapped.map((m) => [m.mint_zh, m.coinCount]))
    const states = new Map<string, SiteHeatState>()
    totalStats.mapped.forEach((mint) => {
      const total = mint.coinCount
      const matched = matchedByMint.get(mint.mint_zh) ?? 0
      // "no-data" means the active filter matches nothing at this mint —
      // not "this mint has zero coins recorded" (total is basically always
      // >0 for a mapped mint, which made foundInSummary's count constant
      // regardless of the filter).
      if (matched <= 0) {
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
  }, [matchedIds, matchedStats, totalStats])

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

  // Not every documented mint has known coordinates yet — this is separate
  // from foundInSummary (which is about the active type/inscription filter,
  // not about which mints could be geocoded at all).
  const plottedSummary = useMemo(
    () => ({ plotted: totalStats.mapped.length, total: totalStats.mapped.length + totalStats.unmapped.length }),
    [totalStats]
  )

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
            <T k={filterActive ? 'map.currentView.mintTownDbActive' : 'map.currentView.mintTownDbNone'} />
          </p>
          <MapExplanation viewMode={viewMode} />
          <p className="text-sm text-gray-700">
            <T
              k="visualizations.mintsPlotted"
              vars={{ plotted: plottedSummary.plotted, total: plottedSummary.total }}
            />
          </p>
          <TypologyFilterBar
            sel={sel}
            onChange={setSel}
            showInscriptionList
            hierarchyRows={hierarchyRows}
            coinIssues={coinIssues}
            compact
          />

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

/* ── Museum Collections (ANS specimens) ─────────────────────────────────── */

type MuseumTab = 'mint' | 'search'

/** Same floating card chrome as MapVisualizationOverlay (mobile collapse
 * toggle included), with its own top-level tab row — Mint Town (the map
 * filter controls) vs Search (accession-number lookup) — playing the same
 * role its Mint Town / Find Site tabs play on the map visualizations page,
 * just as in-panel tab state instead of separate routes, since Museum
 * Collections is a single page. */
function MuseumMapOverlay({
  tab,
  onTabChange,
  children,
}: {
  tab: MuseumTab
  onTabChange: (tab: MuseumTab) => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="map-vis-overlay">
      <div className="rounded-lg border border-brand/15 bg-white/95 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3">
          <span className="shrink-0 text-sm font-semibold text-gray-700">
            <T k="nav.spadeHeatmap" />
          </span>

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

        <div
          className={`${open ? 'block' : 'hidden'} max-h-[min(60dvh,28rem)] overflow-y-auto border-t border-brand/10 px-2.5 py-2.5 sm:px-3 lg:block`}
        >
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <span className="shrink-0 text-sm font-semibold text-gray-700">
              <T k="visualizations.viewByLabel" />
            </span>
            <ToggleButtons
              value={tab}
              onChange={onTabChange}
              options={[
                { value: 'mint' as const, label: <T k="visualizations.tabs.mintTown" /> },
                { value: 'search' as const, label: <T k="search.title" /> },
              ]}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Museum Collections page's map — visually and behaviorally the same as
 * MintTownVisualization above (same overlay shell, view/density toggle,
 * typology filter bar, and legend) on its Mint Town tab, except every mint
 * aggregate comes from public.ans_data specimens (lib/ans-museum-data.ts)
 * instead of database finds. See computeAnsMintStats / getMatchingAnsSpecimens
 * in lib/pointed-spade-data.ts for how the two data sources diverge under
 * the hood while sharing this same rendering. Its Search tab
 * (AccessionNumberSearch) looks up specimens by accession number instead.
 */
export function AnsMintTownVisualization({
  specimens,
  coinIssues,
  hierarchyRows,
}: {
  specimens: AnsSpecimen[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
}) {
  const [tab, setTab] = useState<MuseumTab>('mint')
  const [viewMode, setViewMode] = useState<ViewMode>('points')
  const [sel, setSel] = useState<TypologyFilterSelection>(emptyTypologySelection())
  // Order of selection (not of `specimens`) so each pick keeps its color
  // slot as later picks are added/removed around it. Keyed by ans_data.id —
  // catalog_number isn't unique (some specimens share an accession number).
  const {
    selected: selectedOrder,
    colorByValue: selectedColorById,
    toggle: toggleSelected,
    clear: clearSelected,
  } = useSelectionColors()

  const filterActive = hasTypologyFilter(sel)

  const specimensById = useMemo(() => new Map(specimens.map((s) => [s.id, s])), [specimens])

  const selectedSpecimens = useMemo(
    () =>
      selectedOrder
        .map((id) => {
          const specimen = specimensById.get(id)
          if (!specimen) return null
          return { specimen, color: selectedColorById.get(id) ?? SELECTION_COLORS[0] }
        })
        .filter((entry): entry is { specimen: AnsSpecimen; color: string } => entry !== null),
    [selectedOrder, specimensById, selectedColorById]
  )

  const selectedKeys = useMemo(() => new Set(selectedOrder), [selectedOrder])

  // One dropped pin per selected specimen with known mint coordinates —
  // several selections can share a mint town (or even a catalog_number), so
  // pins are keyed by specimen id, never deduplicated by location or label.
  const pins = useMemo<PinPoint[]>(
    () =>
      selectedSpecimens.flatMap(({ specimen, color }) => {
        const town = specimen.mint_zh ? getMintByNameZh(specimen.mint_zh) : undefined
        if (town?.lat == null || town?.lng == null) return []
        return [
          {
            key: specimen.id,
            lat: town.lat,
            lng: town.lng,
            color,
            label: specimen.catalog_number ?? specimen.id,
            href: specimen.catalog_number ? ansCollectionUrl(specimen.catalog_number) : undefined,
          },
        ]
      }),
    [selectedSpecimens]
  )

  const matchedSpecimens = useMemo(
    () => getMatchingAnsSpecimens(specimens, hierarchyRows, sel),
    [specimens, hierarchyRows, sel]
  )

  const totalStats = useMemo(() => computeAnsMintStats(specimens), [specimens])
  const matchedStats = useMemo(() => computeAnsMintStats(matchedSpecimens ?? []), [matchedSpecimens])

  const mintPoints = useMemo(() => toMintPoints(totalStats.mapped), [totalStats])

  const mintStates = useMemo(() => {
    if (!matchedSpecimens) return null
    const matchedByMint = new Map(matchedStats.mapped.map((m) => [m.mint_zh, m.coinCount]))
    const states = new Map<string, SiteHeatState>()
    totalStats.mapped.forEach((mint) => {
      const total = mint.coinCount
      const matched = matchedByMint.get(mint.mint_zh) ?? 0
      if (matched <= 0) {
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
  }, [matchedSpecimens, matchedStats, totalStats])

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

  const plottedSummary = useMemo(
    () => ({ plotted: totalStats.mapped.length, total: totalStats.mapped.length + totalStats.unmapped.length }),
    [totalStats]
  )

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
        pins={pins}
      />

      <MuseumMapOverlay tab={tab} onTabChange={setTab}>
        {tab === 'search' ? (
          <AccessionNumberSearch
            specimens={specimens}
            selectedKeys={selectedKeys}
            selectedSpecimens={selectedSpecimens}
            onToggle={toggleSelected}
            onClear={clearSelected}
          />
        ) : (
          <div className="space-y-2.5">
            <ViewModeRow viewMode={viewMode} onChange={setViewMode} />

            <p className="text-sm leading-snug text-gray-700">
              <T k={filterActive ? 'map.currentView.mintTownAnsActive' : 'map.currentView.mintTownAnsNone'} />
            </p>
            <MapExplanation viewMode={viewMode} />
            <p className="text-sm text-gray-700">
              <T
                k="visualizations.mintsPlotted"
                vars={{ plotted: plottedSummary.plotted, total: plottedSummary.total }}
              />
            </p>
            <TypologyFilterBar
              sel={sel}
              onChange={setSel}
              showInscriptionList
              hierarchyRows={hierarchyRows}
              coinIssues={coinIssues}
              compact
            />

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
        )}
      </MuseumMapOverlay>

      {tab === 'mint' && (filterActive || viewMode === 'density') && (
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
