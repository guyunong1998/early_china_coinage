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
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  MapVisCanvas,
  mintSizeMetrics,
  type ComparePoint,
  type MintSizeBy,
  type PinPoint,
} from '@/components/map/MapVisCanvas'
import { AccessionNumberSearch } from '@/components/museum/AccessionNumberSearch'
import { MapVisualizationOverlay } from '@/components/visualizations/MapVisualizationOverlay'
import { TypologyFilterBar } from '@/components/visualizations/TypologyFilterBar'
import { T } from '@/components/i18n/T'
import { ClickHint } from '@/components/ui/ClickHint'
import { MultiSelectSearch } from '@/components/ui/MultiSelectSearch'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { PrecisionFilter } from '@/lib/city-boundaries'
import {
  SELECTION_COLORS,
  useSelectionColors,
  buildDensityLayer,
  type DensityRange,
} from '@/lib/color-scale'
import { computeSiteHeatStates, filterToFullyQuantifiedContexts } from '@/lib/context-heatmap'
import type { FilterMode, SiteHeatState, ViewMode } from '@/lib/context-heatmap'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { findMintByNameZh } from '@/lib/mint-directory'
import {
  buildMintFilterOptions,
  computeSiteMintQuantities,
  formatMintOptionLabel,
  getMatchingCoinIssueIdsByMints,
} from '@/lib/mint-filter'
import {
  ansCollectionUrl,
  buildAnsInscriptionSource,
  buildAnsTypologyMintCounts,
  computeAnsMintStats,
  computeAnsMintTypeQuantities,
  computeMintStatsFromFinds,
  getMatchingAnsSpecimensMulti,
  toMintPoints,
  type AnsSpecimen,
  type HeatmapSource,
} from '@/lib/mint-stats'
import {
  buildTypologySiteCounts,
  buildTypologyMintCounts,
  computeMintTypeQuantities,
  computeSiteTypeQuantities,
  describeTypologySelection,
  emptyTypologySelection,
  getMatchingCoinIssueIdsMulti,
  hasTypologyFilter,
  typologySelectionKey,
  type InscriptionSourceRow,
  type TypologyFilterSelection,
  type TypologyOptionCounts,
  type TypologySelectionEntry,
} from '@/lib/typology-filter'
import type { CoinIssueDisplay, CoinTypeHierarchyRow, HeatmapFind, MapSite, MintInfo } from '@/lib/types'

/* ── shared filter-panel pieces ─────────────────────────────────────────── */

function ToggleButtons<T extends string>({
  value,
  options,
  onChange,
  compact = false,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  /** Smaller pill size — same footprint as ToggleChip. Used where a group's
   * options should read as lower-priority than Display/Filter by (e.g. Size
   * by), without changing the group's own value-driven selection behavior. */
  compact?: boolean
}) {
  return (
    <div className="filter-row">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded font-semibold transition ${compact ? 'small-pill px-2 py-0.5 text-xs' : 'large-pill px-2.5 py-1 text-sm'} ${
            value === opt.value
              ? compact
                ? 'small-pill-active'
                : 'large-pill-active'
              : compact
                ? 'small-pill-inactive'
                : 'large-pill-inactive'
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
  const { t } = useLanguage()
  const explainKey = viewMode === 'density' ? 'map.explain.density' : viewMode === 'compare' ? 'map.explain.compare' : 'map.explain.points'
  return (
    <div className="filter-row">
      <ClickHint
        hint={
          <div className="space-y-1.5">
            <p>{t('map.view.labelHint')}</p>
            <p>{t(explainKey)}</p>
          </div>
        }
        className="hint-underline text-sm font-semibold text-gray-700"
      >
        <T k="map.view.label" />
      </ClickHint>
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

/** A single independent on/off pill — same colored-when-active/
 * white-when-not look as ToggleButtons' options, but standalone rather than
 * part of a mutually-exclusive group. Used for the map canvas's overlay
 * toggles (minor rivers, routes, no-data points, incomplete counts) below. */
function ToggleChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`small-pill rounded px-2 py-0.5 text-xs font-semibold transition ${active ? 'small-pill-active' : 'small-pill-inactive'}`}
    >
      {children}
    </button>
  )
}

/** Bootstrap Icons' "question-circle" glyph, inlined since this project
 * doesn't pull in an icon library for a single icon — the (?) trigger next
 * to the Mint Town current-view line (both the database and Museum
 * Collections tabs), where hovering/clicking reveals the mintsPlotted
 * count via ClickHint. */
function QuestionCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="inline-block">
      <path d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16z" />
      <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" />
    </svg>
  )
}

/** The filter panel's "Clear filter" action — identical markup/behavior in
 * all three map-vis panels (Find Site, Mint Town, Museum Collections'
 * Mint Town tab), just wired to each caller's own `clearFilters`. */
function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onClick} className="btn-clear-filters">
        <T k="heatmap.clearFilter" />
      </button>
    </div>
  )
}

function DensityLegend({ range }: { range: DensityRange }) {
  return (
    <>
      <span className="eyebrow text-gray-500">
        <T k="map.legend.density" />
      </span>
      <span className="tabular-nums text-gray-500">{range?.min ?? '—'}</span>
      <span className="inline-block h-2 w-28 rounded-sm map-density-legend-gradient" />
      <span className="tabular-nums text-gray-500">{range?.max ?? '—'}</span>
      <span className="text-gray-500">
        <T k="map.legend.densityHint" />
      </span>
    </>
  )
}

/** Compare view's legend — one swatch per selected group (mint, or coin
 * type), same identity colors (by stable slot, not array position) as each
 * group's chip in its multiselect control and its points on the map.
 * Generic over what's being compared so every Compare view (Find Site by
 * mint/by type, the database Mint Town tab, Museum Collections' Mint Town
 * view) shares this one legend. */
function CompareLegend({
  titleKey,
  entries,
  colorByValue,
}: {
  titleKey: DictionaryKey
  entries: { key: string; label: string }[]
  colorByValue: Map<string, string>
}) {
  return (
    <>
      <span className="eyebrow text-gray-500">
        <T k={titleKey} />
      </span>
      {entries.map((entry) => (
        <span key={entry.key} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: colorByValue.get(entry.key) }}
          />
          {entry.label}
        </span>
      ))}
    </>
  )
}

/** Points view's match-ratio legend — a continuous 0%→100% gradient bar (the
 * same interpolation stateColor()/ratioToColor() already use per-point, see
 * lib/color-scale.ts) rather than the five discrete swatches this used to
 * render, which read as bucketed color steps even though the underlying
 * ratio→color mapping was already continuous. `presentNoCount` and `noData`
 * are categorical states outside the ratio scale, so they keep their own
 * swatches as caller-supplied markup — purely informational now that the
 * canvas overlay's toggle buttons (not this legend) drive whether they're
 * shown (Mint Town / Museum leave `presentNoCount` off, since they have no
 * unquantified-coins concept). */
function RatioLegend({ presentNoCount, noData }: { presentNoCount?: ReactNode; noData: ReactNode }) {
  return (
    <>
      <span className="eyebrow text-gray-500">
        <T k="map.legend.title" />
      </span>
      <span className="tabular-nums text-gray-500">0%</span>
      <span className="inline-block h-2 w-20 rounded-sm map-ratio-legend-gradient" />
      <span className="tabular-nums text-gray-500">100%</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full map-legend-swatch-single-find" />
        <T k="map.legend.singleFind" />
      </span>
      {presentNoCount}
      {noData}
    </>
  )
}

/**
 * Multiselect state for coin-type filtering (Find Site's "by type" mode, the
 * database Mint Town tab, Museum Collections' Mint Town view) — layered over
 * TypologyFilterBar's single-selection "staging" picker (a cascading
 * dropdown, not a flat searchable list) since there's no single click that
 * picks "a coin type": the user builds up one level1..level5 + inscription
 * combination in `staged`.
 *
 * `staged` itself is live: it filters the map immediately as it's built, the
 * same way the old single-select filter did, with no separate "confirm"
 * step. `addAnother()` locks the current `staged` in as a committed pick
 * (its own chip, its own permanent color slot) and resets `staged` to empty
 * so a second, independent pick can be built — that's the only thing "add"
 * is for. `entries` (used for matching/Compare) is therefore the committed
 * list plus `staged` itself, deduped so re-adding an already-committed
 * combination doesn't double it up.
 *
 * Colors are stable the same way useSelectionColors' are: a committed pick
 * claims the lowest free slot and keeps it until removed, so removing one
 * pick never shifts another's color. `staged` gets the same guarantee even
 * before it's committed — its slot is reserved the moment it first becomes
 * non-empty and held fixed while it's edited, so a sibling pick being
 * added/removed elsewhere never changes the color of the pick still being
 * built.
 *
 * `initialSelections` seeds already-committed picks at mount (e.g. a
 * homepage demo link landing on this page with a filter pre-applied) — read
 * once, like any other useState initializer; a later-changing prop doesn't
 * re-seed already-mounted state.
 */
function buildInitialTypologyState(
  coinIssues: InscriptionSourceRow[],
  hierarchyRows: CoinTypeHierarchyRow[],
  initialSelections: TypologyFilterSelection[]
) {
  const order: string[] = []
  const slotById = new Map<string, number>()
  const selByKey = new Map<string, TypologyFilterSelection>()
  const labelByKey = new Map<string, string>()
  initialSelections.forEach((sel) => {
    if (!hasTypologyFilter(sel)) return
    const key = typologySelectionKey(sel)
    if (selByKey.has(key)) return
    order.push(key)
    slotById.set(key, order.length - 1)
    selByKey.set(key, sel)
    labelByKey.set(key, describeTypologySelection(sel, coinIssues, hierarchyRows))
  })
  return { order, slotById, selByKey, labelByKey }
}

function useTypologyMultiSelect(
  coinIssues: InscriptionSourceRow[],
  hierarchyRows: CoinTypeHierarchyRow[],
  initialSelections: TypologyFilterSelection[] = []
) {
  const [staged, setStagedRaw] = useState<TypologyFilterSelection>(emptyTypologySelection())
  const [initial] = useState(() => buildInitialTypologyState(coinIssues, hierarchyRows, initialSelections))
  const [order, setOrder] = useState<string[]>(initial.order)
  const [slotById, setSlotById] = useState<Map<string, number>>(initial.slotById)
  const [selByKey, setSelByKey] = useState<Map<string, TypologyFilterSelection>>(initial.selByKey)
  const [labelByKey, setLabelByKey] = useState<Map<string, string>>(initial.labelByKey)
  // The staged pick's own color slot — reserved the moment it first becomes
  // non-empty and held fixed while it's built up (or while sibling committed
  // picks are added/removed around it), so its color never jumps mid-edit.
  // Freed (back to null) when staged is cleared, whether by committing it
  // (addAnother) or by emptying the picker back out.
  const [stagedSlot, setStagedSlot] = useState<number | null>(null)

  function nextFreeSlot(used: Set<number>): number {
    let slot = 0
    while (used.has(slot)) slot++
    return slot
  }

  function setStaged(sel: TypologyFilterSelection) {
    setStagedRaw(sel)
    if (hasTypologyFilter(sel)) {
      setStagedSlot((prev) => (prev !== null ? prev : nextFreeSlot(new Set(slotById.values()))))
    } else {
      setStagedSlot(null)
    }
  }

  const committedEntries = useMemo<TypologySelectionEntry[]>(
    () =>
      order.map((key) => ({
        key,
        sel: selByKey.get(key) ?? emptyTypologySelection(),
        label: labelByKey.get(key) ?? key,
      })),
    [order, selByKey, labelByKey]
  )

  const stagedKey = useMemo(() => (hasTypologyFilter(staged) ? typologySelectionKey(staged) : null), [staged])
  // Defer the live staged pick's map impact so the typology dropdowns stay
  // responsive while matchedIds / marker restyle catch up a frame later.
  const deferredStaged = useDeferredValue(staged)
  const deferredStagedKey = useMemo(
    () => (hasTypologyFilter(deferredStaged) ? typologySelectionKey(deferredStaged) : null),
    [deferredStaged]
  )

  const colorByValue = useMemo(() => {
    const map = new Map<string, string>()
    order.forEach((key) => map.set(key, SELECTION_COLORS[(slotById.get(key) ?? 0) % SELECTION_COLORS.length]))
    if (stagedKey && stagedSlot !== null && !map.has(stagedKey)) {
      map.set(stagedKey, SELECTION_COLORS[stagedSlot % SELECTION_COLORS.length])
    }
    return map
  }, [order, slotById, stagedKey, stagedSlot])

  const entries = useMemo<TypologySelectionEntry[]>(() => {
    if (!deferredStagedKey || order.includes(deferredStagedKey)) return committedEntries
    return [
      ...committedEntries,
      {
        key: deferredStagedKey,
        sel: deferredStaged,
        label: describeTypologySelection(deferredStaged, coinIssues, hierarchyRows),
      },
    ]
  }, [committedEntries, deferredStagedKey, order, deferredStaged, coinIssues, hierarchyRows])

  function addAnother() {
    if (!stagedKey || stagedSlot === null) return
    if (!order.includes(stagedKey)) {
      setOrder((prev) => [...prev, stagedKey])
      setSlotById((prev) => new Map(prev).set(stagedKey, stagedSlot))
      setSelByKey((prev) => new Map(prev).set(stagedKey, staged))
      setLabelByKey((prev) => new Map(prev).set(stagedKey, describeTypologySelection(staged, coinIssues, hierarchyRows)))
    }
    setStaged(emptyTypologySelection())
  }

  function remove(key: string) {
    setOrder((prev) => prev.filter((k) => k !== key))
    setSlotById((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
    setSelByKey((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
    setLabelByKey((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  function clear() {
    setOrder([])
    setSlotById(new Map())
    setSelByKey(new Map())
    setLabelByKey(new Map())
    setStaged(emptyTypologySelection())
  }

  return { staged, setStaged, entries, committedEntries, colorByValue, addAnother, remove, clear }
}

/** The coin-type multiselect control itself: TypologyFilterBar as a live
 * staging picker (filters the map as it's built, no confirm step) plus an
 * "Add another" button to lock the current pick in and start a second one,
 * and a chip list of locked-in picks (each with its identity color and a
 * remove button) — the type equivalent of MultiSelectSearch's flat
 * searchable list. */
function TypologyMultiSelect({
  staged,
  onStagedChange,
  committedEntries,
  colorByValue,
  onAddAnother,
  onRemove,
  onClear,
  onClearFilters,
  filterActive,
  hierarchyRows,
  coinIssues,
  optionCounts,
}: {
  staged: TypologyFilterSelection
  onStagedChange: (sel: TypologyFilterSelection) => void
  committedEntries: TypologySelectionEntry[]
  colorByValue: Map<string, string>
  onAddAnother: () => void
  onRemove: (key: string) => void
  onClear: () => void
  /** Clears the map's active filter — forwarded to TypologyFilterBar's
   * "Clear filter" button, shown next to Add whenever `filterActive`. */
  onClearFilters: () => void
  filterActive: boolean
  hierarchyRows: CoinTypeHierarchyRow[]
  coinIssues: InscriptionSourceRow[]
  /** Counts shown beside each dropdown option — sites on Find Site,
   * specimen quantity on the Mint Town tabs. See TypologyOptionCounts' doc
   * comment in lib/typology-filter.ts. */
  optionCounts?: TypologyOptionCounts
}) {
  const { t } = useLanguage()
  const canAddAnother = hasTypologyFilter(staged) && !committedEntries.some((e) => e.key === typologySelectionKey(staged))

  return (
    <div className="space-y-2">
      <TypologyFilterBar
        sel={staged}
        onChange={onStagedChange}
        showInscriptionList
        hierarchyRows={hierarchyRows}
        coinIssues={coinIssues}
        optionCounts={optionCounts}
        compact
        onAddAnother={onAddAnother}
        canAddAnother={canAddAnother}
        onClearFilters={onClearFilters}
        showClearFilters={filterActive}
      />

      {committedEntries.length > 0 && (
        <div className="filter-row">
          <span className="text-xs text-gray-500">{t('ui.selectedCount', { count: committedEntries.length })}</span>
          {committedEntries.map((entry) => (
            <span
              key={entry.key}
              className="flex items-center gap-1 rounded-full border border-brand/20 bg-white px-2 py-0.5 text-xs"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: colorByValue.get(entry.key) }}
              />
              {entry.label}
              <button
                type="button"
                onClick={() => onRemove(entry.key)}
                aria-label={t('ui.clear')}
                className="text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" onClick={onClear} className="text-link-sm">
            <T k="ui.clear" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Find Site tab ───────────────────────────────────────────────────────── */

const PRECISION_TABS: Array<{ id: PrecisionFilter; key: DictionaryKey }> = [
  { id: 'all', key: 'search.precision.all' },
  { id: 'site', key: 'search.precision.site' },
  { id: 'county', key: 'search.precision.county' },
  { id: 'city', key: 'search.precision.city' },
]

/** The raw coin count a site/mint contributes to the density heat layer —
 * null excludes it entirely (no record of the selected type/mint at all).
 * `unquantified` (present but no usable count) is also excluded from the
 * weighted scale rather than guessed at, since there's no real number to
 * min-max against. Shared here since the density point list is computed by
 * this orchestrator for both the Find Site and Mint Town tabs. */
function heatWeight(state: SiteHeatState, totalQty: number): number | null {
  switch (state.kind) {
    case 'no-filter':
    case 'pure':
      return totalQty
    case 'no-data':
    case 'unquantified':
      return null
    case 'ratio':
      return state.matchedQty
  }
}

export function FindSpotsVisualization({
  sites,
  coinIssues,
  hierarchyRows,
  finds,
  mints,
  currentPrecision,
  precisionCounts,
  initialMode,
  initialViewMode,
  initialMintNames,
  initialTypeSelections,
}: {
  sites: MapSite[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
  finds: HeatmapFind[]
  mints: MintInfo[]
  /** Precision (site/county/city) links re-fetch sites server-side via
   * searchParams, so the page filters `sites` and hands down only the
   * current value + counts — the links themselves render here. */
  currentPrecision: PrecisionFilter
  precisionCounts: Record<PrecisionFilter, number>
  /** Pre-built filter state for a deep link (e.g. the homepage demo
   * carousel) — read once at mount, same as any other useState initializer.
   * See lib/visualization-deeplink.ts / lib/demo-visualizations.ts. */
  initialMode?: FilterMode
  initialViewMode?: ViewMode
  initialMintNames?: string[]
  initialTypeSelections?: TypologyFilterSelection[]
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<FilterMode>(initialMode ?? 'type')
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? 'points')
  const [showNoData, setShowNoData] = useState(false)
  const [includeUnquantified, setIncludeUnquantified] = useState(true)
  const [showMinorRivers, setShowMinorRivers] = useState(false)
  const [showRoutes, setShowRoutes] = useState(false)
  const findsForFilter = useMemo(
    () => (includeUnquantified ? finds : filterToFullyQuantifiedContexts(finds)),
    [finds, includeUnquantified]
  )
  const {
    staged: stagedType,
    setStaged: setStagedType,
    entries: typeEntries,
    committedEntries: typeCommittedEntries,
    colorByValue: typeColorByValue,
    addAnother: addAnotherTypeEntry,
    remove: removeTypeEntry,
    clear: clearTypeEntries,
  } = useTypologyMultiSelect(coinIssues, hierarchyRows, initialTypeSelections)

  const typeOptionCounts = useMemo(
    () => buildTypologySiteCounts(findsForFilter, coinIssues, hierarchyRows, stagedType),
    [findsForFilter, coinIssues, hierarchyRows, stagedType]
  )

  const mintOptions = useMemo(() => buildMintFilterOptions(coinIssues, finds, mints), [coinIssues, finds, mints])
  // initialMintNames (zh names, from a deep link) resolved to the mint_ids
  // useSelectionColors actually keys by — computed once at mount, same as
  // the initializer it feeds.
  const [initialMintIds] = useState(() =>
    (initialMintNames ?? [])
      .map((name) => mintOptions.find((m) => m.mint_zh === name)?.mint_id)
      .filter((id): id is string => !!id)
  )
  // Order of selection (not of `mintOptions`) so each pick keeps its color
  // slot — and pin color — as later picks are added/removed around it.
  const { selected: mintFilters, colorByValue: mintColorByValue, toggle: toggleMintFilter, clear: clearMintFilters } =
    useSelectionColors(initialMintIds)
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

  const filterActive = mode === 'type' ? typeEntries.length > 0 : mintFilters.length > 0

  const matchedIds = useMemo(() => {
    if (mode === 'mint') return getMatchingCoinIssueIdsByMints(coinIssues, mintFilters)
    return getMatchingCoinIssueIdsMulti(coinIssues, hierarchyRows, typeEntries)
  }, [mode, coinIssues, hierarchyRows, mintFilters, typeEntries])

  const siteStates = useMemo(
    () =>
      computeSiteHeatStates(
        sites.map((s) => s.site_code),
        findsForFilter,
        matchedIds
      ),
    [sites, findsForFilter, matchedIds]
  )

  const foundInSummary = useMemo(() => {
    if (!siteStates) return null
    const foundCount = [...siteStates.values()].filter((s) => s.kind !== 'no-data').length
    return { foundCount, totalCount: sites.length }
  }, [siteStates, sites])

  const density = useMemo(() => {
    const points = sites
      .filter((site): site is typeof site & { lat: number; lng: number } => site.lat != null && site.lng != null)
      .map((site) => {
        const state: SiteHeatState = siteStates?.get(site.site_code) ?? { kind: 'no-filter' }
        return { lat: site.lat, lng: site.lng, weight: heatWeight(state, site.total_quantity_for_map ?? 0) }
      })
    return buildDensityLayer(points)
  }, [sites, siteStates])

  // Filtering by mint: plot each selected mint town's own location too, one
  // dropped pin per selection (colored to match its chip in the multiselect
  // list), when we know where it is.
  const pins = useMemo<PinPoint[]>(() => {
    if (mode !== 'mint') return []
    return mintFilters.flatMap((mintId) => {
      const opt = mintOptions.find((m) => m.mint_id === mintId)
      const mint = opt?.mint_zh ? findMintByNameZh(mints, opt.mint_zh) : undefined
      if (mint?.lat == null || mint?.lng == null) return []
      return [
        {
          key: mintId,
          lat: mint.lat,
          lng: mint.lng,
          color: mintColorByValue.get(mintId) ?? SELECTION_COLORS[0],
          label: `${mint.name_zh}${mint.name_en ? ` (${mint.name_en})` : ''}`,
          href: mint.mint_code ? `/mints/${mint.mint_code}` : undefined,
        },
      ]
    })
  }, [mode, mintFilters, mintOptions, mintColorByValue, mints])

  // Compare view: one point per (site, mint) or (site, type) that has a
  // nonzero matching quantity, colored by that group's identity color —
  // unlike points/density (which OR the selection into one match-ratio per
  // site), a site matching two selected groups shows up twice here.
  const siteMintQuantities = useMemo(() => {
    if (mode !== 'mint' || viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeSiteMintQuantities(findsForFilter, coinIssues, mintFilters)
  }, [mode, viewMode, findsForFilter, coinIssues, mintFilters])

  const siteTypeQuantities = useMemo(() => {
    if (mode !== 'type' || viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeSiteTypeQuantities(findsForFilter, coinIssues, hierarchyRows, typeEntries)
  }, [mode, viewMode, findsForFilter, coinIssues, hierarchyRows, typeEntries])

  const comparePoints = useMemo<ComparePoint[]>(() => {
    if (viewMode !== 'compare') return []
    const sitesByCode = new Map(sites.map((s) => [s.site_code, s]))
    const points: ComparePoint[] = []

    if (mode === 'mint') {
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
            groupKey: siteCode,
            lat: site.lat,
            lng: site.lng,
            color,
            qty,
            locationLabel: site.site_name_zh ?? siteCode,
            groupLabel: opt ? formatMintOptionLabel(opt) : mintId,
            groupKindLabel: t('map.compare.mintKindLabel'),
            href: `/sites/${siteCode}`,
          })
        })
      })
    } else {
      typeEntries.forEach((entry) => {
        const color = typeColorByValue.get(entry.key) ?? SELECTION_COLORS[0]
        siteTypeQuantities.forEach((byEntry, siteCode) => {
          const qty = byEntry.get(entry.key)
          if (!qty) return
          const site = sitesByCode.get(siteCode)
          if (site?.lat == null || site?.lng == null) return
          points.push({
            key: `${siteCode}::${entry.key}`,
            groupKey: siteCode,
            lat: site.lat,
            lng: site.lng,
            color,
            qty,
            locationLabel: site.site_name_zh ?? siteCode,
            groupLabel: entry.label,
            groupKindLabel: t('map.compare.typeKindLabel'),
            href: `/sites/${siteCode}`,
          })
        })
      })
    }

    return points
  }, [
    mode,
    viewMode,
    mintFilters,
    mintOptions,
    mintColorByValue,
    siteMintQuantities,
    typeEntries,
    typeColorByValue,
    siteTypeQuantities,
    sites,
    t,
  ])

  function clearFilters() {
    clearTypeEntries()
    clearMintFilters()
  }

  const precisionButtons = PRECISION_TABS.map((tab) => {
    const isActive = tab.id === currentPrecision
    const href = `/visualizations/find-site${tab.id === 'all' ? '' : `?precision=${tab.id}`}`
    return (
      <span key={tab.id} className="pointer-events-auto inline-flex shrink-0 items-center gap-1">
        <Link
          href={href}
          className={`small-pill rounded px-2 py-0.5 text-xs font-semibold transition ${isActive ? 'small-pill-active' : 'small-pill-inactive'}`}
        >
          <T k={tab.key} /> ({precisionCounts[tab.id]})
        </Link>
      </span>
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
        densityLatLngs={density.latLngs}
        filterActive={filterActive}
        showNoData={showNoData}
        showMinorRivers={showMinorRivers}
        showRoutes={showRoutes}
        pins={pins}
        comparePoints={comparePoints}
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5">
          <div className="space-y-2 map-display-section">
            <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare />

            <div className="filter-row">
              <ToggleChip active={showMinorRivers} onClick={() => setShowMinorRivers((v) => !v)}>
                <T k="map.layers.minorRivers" />
              </ToggleChip>
              <ToggleChip
                active={showRoutes}
                onClick={() => setShowRoutes((v) => !v)}
                title={t('map.layers.routesHint')}
              >
                <T k="map.layers.routes" />
              </ToggleChip>
              <ToggleChip active={showNoData} onClick={() => setShowNoData((v) => !v)}>
                <T k="map.filter.noDataToggle" />
              </ToggleChip>
              <ToggleChip
                active={includeUnquantified}
                onClick={() => setIncludeUnquantified((v) => !v)}
                title={t('map.filter.quantityLabelHint')}
              >
                <T k="map.filter.quantityLabel" />
              </ToggleChip>
            </div>

            <div className="filter-row">
              <ClickHint
                hint={t('search.precision.allHint')}
                className="hint-underline text-sm font-semibold text-gray-700"
              >
                <T k="search.precision.label" />
              </ClickHint>
              {precisionButtons}
            </div>
          </div>

          <div className="space-y-2 map-filter-section">
            <div className="filter-row">
              <ClickHint hint={t('map.filter.modeLabelHint')} className="hint-underline text-sm font-semibold text-gray-700">
                <T k="map.filter.modeLabel" />
              </ClickHint>
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

            <p className="text-sm leading-snug text-gray-700">
              {mode === 'type' ? (
                typeEntries.length === 0 ? (
                  <T k="map.currentView.typeNone" />
                ) : (
                  <T k={viewMode === 'compare' ? 'map.currentView.typeActiveCompare' : 'map.currentView.typeActiveOr'} />
                )
              ) : mintFilters.length === 0 ? (
                <T k="map.currentView.mintNone" />
              ) : (
                <T k={viewMode === 'compare' ? 'map.currentView.mintActiveCompare' : 'map.currentView.mintActiveOr'} />
              )}
            </p>

            {mode === 'type' && (
              <TypologyMultiSelect
                staged={stagedType}
                onStagedChange={setStagedType}
                committedEntries={typeCommittedEntries}
                colorByValue={typeColorByValue}
                onAddAnother={addAnotherTypeEntry}
                onRemove={removeTypeEntry}
                onClear={clearTypeEntries}
                onClearFilters={clearFilters}
                filterActive={filterActive}
                hierarchyRows={hierarchyRows}
                coinIssues={coinIssues}
                optionCounts={typeOptionCounts}
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
          </div>

          {filterActive && foundInSummary && (
            <p className="text-sm text-gray-700">
              <T
                k="heatmap.foundIn"
                vars={{ found: foundInSummary.foundCount, total: foundInSummary.totalCount }}
              />
            </p>
          )}
          {/* Type mode's clear button lives inside TypologyMultiSelect, next to Add. */}
          {mode === 'mint' && filterActive && <ClearFiltersButton onClick={clearFilters} />}
        </div>
      </MapVisualizationOverlay>

      {(filterActive || viewMode === 'density' || viewMode === 'compare') && (
        <div className="heatmap_legend">
          {viewMode === 'compare' &&
            (mode === 'mint' ? (
              <CompareLegend
                titleKey="map.legend.byMint"
                entries={mintFilters.map((id) => ({
                  key: id,
                  label: mintOptions.find((m) => m.mint_id === id)?.mint_zh ?? id,
                }))}
                colorByValue={mintColorByValue}
              />
            ) : (
              <CompareLegend titleKey="map.legend.byType" entries={typeEntries} colorByValue={typeColorByValue} />
            ))}
          {filterActive && viewMode === 'points' && (
            <RatioLegend
              presentNoCount={
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full map-legend-swatch-unquantified" />
                  <T k="heatmap.legend.presentNoCount" />
                </span>
              }
              noData={
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full map-legend-swatch-no-data" />
                  <T k="heatmap.legend.noData" />
                </span>
              }
            />
          )}
          {viewMode === 'density' && <DensityLegend range={density.range} />}
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
  mints,
  initialViewMode,
  initialTypeSelections,
}: {
  finds: HeatmapFind[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
  mints: MintInfo[]
  /** Pre-built filter state for a deep link — see FindSpotsVisualization's
   * matching props. */
  initialViewMode?: ViewMode
  initialTypeSelections?: TypologyFilterSelection[]
}) {
  const { t } = useLanguage()
  // Only one data source exists today (database finds) — the toggle row is
  // kept (rather than collapsed away) so a future data source is just
  // another entry in `options` below, not a UI rebuild.
  const [source, setSource] = useState<HeatmapSource>('database')
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? 'points')
  // Circle size encodes mint importance — combined (default) uses the
  // geometric mean of log(coins+1) and log(finds+1); the other two modes
  // isolate each channel.
  const [sizeBy, setSizeBy] = useState<MintSizeBy>('combined')
  const [showNoData, setShowNoData] = useState(true)
  const [showMinorRivers, setShowMinorRivers] = useState(false)
  const [showRoutes, setShowRoutes] = useState(false)
  const {
    staged: stagedType,
    setStaged: setStagedType,
    entries: typeEntries,
    committedEntries: typeCommittedEntries,
    colorByValue: typeColorByValue,
    addAnother: addAnotherTypeEntry,
    remove: removeTypeEntry,
    clear: clearTypeEntries,
  } = useTypologyMultiSelect(coinIssues, hierarchyRows, initialTypeSelections)

  const filterActive = typeEntries.length > 0

  const typeOptionCounts = useMemo(
    () => buildTypologyMintCounts(finds, coinIssues, hierarchyRows, stagedType),
    [finds, coinIssues, hierarchyRows, stagedType]
  )

  const matchedIds = useMemo(
    () => getMatchingCoinIssueIdsMulti(coinIssues, hierarchyRows, typeEntries),
    [coinIssues, hierarchyRows, typeEntries]
  )

  // Every known mint town's full totals, regardless of the active filter —
  // this is both the plotted point list (always complete, like Find Site's
  // site list) and the "typical information" source for popups.
  const totalStats = useMemo(
    () => computeMintStatsFromFinds(finds, coinIssues, null, mints),
    [finds, coinIssues, mints]
  )
  // The same aggregation narrowed to the active filter, used only to read
  // off each mint's matched coin count.
  const matchedStats = useMemo(
    () => computeMintStatsFromFinds(finds, coinIssues, matchedIds, mints, { includeInscriptions: false }),
    [finds, coinIssues, matchedIds, mints]
  )

  const mintPoints = useMemo(() => toMintPoints(totalStats.mapped), [totalStats])

  // Per-mint heat state: the percentage of a mint's coins that are the
  // selected type, out of its total coins — same "matched vs. total" ratio
  // concept as Find Site's per-site heat state, just aggregated over the
  // whole mint instead of per find-context.
  const mintStates = useMemo(() => {
    if (!matchedIds) return null
    const matchedByMint = new Map(matchedStats.mapped.map((m) => [m.mint_zh, m]))
    const states = new Map<string, SiteHeatState>()
    totalStats.mapped.forEach((mint) => {
      const total = mint.coinCount
      const matched = matchedByMint.get(mint.mint_zh)
      const matchedCoins = matched?.coinCount ?? 0
      // "no-data" means the active filter matches nothing at this mint —
      // not "this mint has zero coins recorded" (total is basically always
      // >0 for a mapped mint, which made foundInSummary's count constant
      // regardless of the filter).
      if (matchedCoins <= 0) {
        states.set(mint.mint_zh, { kind: 'no-data' })
        return
      }
      if (matchedCoins >= total) {
        states.set(mint.mint_zh, { kind: 'pure' })
        return
      }
      states.set(mint.mint_zh, {
        kind: 'ratio',
        ratio: matchedCoins / total,
        matchedQty: matchedCoins,
        totalQty: total,
        contextCount: 1,
        // Lets circle size follow the selected type's own find count at
        // this mint (e.g. 邯郸) instead of the mint's overall finds.
        matchedFindCount: matched?.findCount ?? 0,
      })
    })
    return states
  }, [matchedIds, matchedStats, totalStats])

  const density = useMemo(() => {
    const points = mintPoints.map((mint) => {
      const state: SiteHeatState = mintStates?.get(mint.mint_zh) ?? { kind: 'no-filter' }
      // Heat weight is the real coin count, not the log/sqrt-compressed score
      // circle diameter uses — min-max needs a linear quantity to stretch
      // across, and the legend labels this range in coin counts.
      const { coins } = mintSizeMetrics(mint, state)
      return { lat: mint.lat, lng: mint.lng, weight: heatWeight(state, coins) }
    })
    return buildDensityLayer(points)
  }, [mintPoints, mintStates])

  // Counts across every documented mint (mapped + unmapped), not just the
  // ones with coordinates to plot — `plottedCount` then narrows that down to
  // how many of the matches actually show up as points on the map.
  const foundInSummary = useMemo(() => {
    if (!mintStates) return null
    const plottedCount = [...mintStates.values()].filter((s) => s.kind !== 'no-data').length
    const foundCount = [...matchedStats.mapped, ...matchedStats.unmapped].filter((m) => m.coinCount > 0).length
    return { foundCount, totalCount: totalStats.mapped.length + totalStats.unmapped.length, plottedCount }
  }, [mintStates, matchedStats, totalStats])

  // Not every documented mint has known coordinates yet — this is separate
  // from foundInSummary (which is about the active type/inscription filter,
  // not about which mints could be geocoded at all).
  const plottedSummary = useMemo(
    () => ({ plotted: totalStats.mapped.length, total: totalStats.mapped.length + totalStats.unmapped.length }),
    [totalStats]
  )

  // Compare view: one point per (mint, type) that has a nonzero matching
  // quantity, colored by that type's identity color — a mint matching two
  // selected types shows up twice here.
  const mintTypeQuantities = useMemo(() => {
    if (viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeMintTypeQuantities(finds, coinIssues, hierarchyRows, typeEntries)
  }, [viewMode, finds, coinIssues, hierarchyRows, typeEntries])

  const comparePoints = useMemo<ComparePoint[]>(() => {
    if (viewMode !== 'compare') return []
    const points: ComparePoint[] = []
    typeEntries.forEach((entry) => {
      const color = typeColorByValue.get(entry.key) ?? SELECTION_COLORS[0]
      mintTypeQuantities.forEach((byEntry, mintZh) => {
        const qty = byEntry.get(entry.key)
        if (!qty) return
        const mint = mintPoints.find((m) => m.mint_zh === mintZh)
        if (!mint) return
        points.push({
          key: `${mintZh}::${entry.key}`,
          groupKey: mintZh,
          lat: mint.lat,
          lng: mint.lng,
          color,
          qty,
          locationLabel: `${mint.mint_zh}${mint.mint_en ? ` (${mint.mint_en})` : ''}`,
          groupLabel: entry.label,
          groupKindLabel: t('map.compare.typeKindLabel'),
          href: mint.mint_code ? `/mints/${mint.mint_code}` : undefined,
        })
      })
    })
    return points
  }, [viewMode, typeEntries, typeColorByValue, mintTypeQuantities, mintPoints, t])

  function clearFilters() {
    clearTypeEntries()
  }

  return (
    <div className="absolute inset-0">
      <MapVisCanvas
        kind="mints"
        mintPoints={mintPoints}
        mintStates={mintStates}
        viewMode={viewMode}
        densityLatLngs={density.latLngs}
        filterActive={filterActive}
        showNoData={showNoData}
        showMinorRivers={showMinorRivers}
        showRoutes={showRoutes}
        comparePoints={comparePoints}
        sizeBy={sizeBy}
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5">
          {/* <div className="filter-row">
            <span className="hint-underline text-sm font-semibold text-gray-700">
              <T k="visualizations.data.label" />
            </span>
            <ToggleButtons
              value={source}
              onChange={setSource}
              options={[{ value: 'database' as const, label: <T k="visualizations.data.database" /> }]}
            />
          </div> */}

          <div className="space-y-2 map-display-section">
            <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare />

            <div className="filter-row">
              <ToggleChip active={showMinorRivers} onClick={() => setShowMinorRivers((v) => !v)}>
                <T k="map.layers.minorRivers" />
              </ToggleChip>
              <ToggleChip
                active={showRoutes}
                onClick={() => setShowRoutes((v) => !v)}
                title={t('map.layers.routesHint')}
              >
                <T k="map.layers.routes" />
              </ToggleChip>
              <ToggleChip active={showNoData} onClick={() => setShowNoData((v) => !v)}>
                <T k="map.filter.noDataToggle" />
              </ToggleChip>
            </div>

            <div className="filter-row">
              <ClickHint
                hint={t('map.sizeBy.labelHint')}
                className="hint-underline text-sm font-semibold text-gray-700"
              >
                <T k="map.sizeBy.label" />
              </ClickHint>
              <ToggleButtons
                value={sizeBy}
                onChange={setSizeBy}
                compact
                options={[
                  { value: 'combined' as const, label: <T k="map.sizeBy.combined" /> },
                  { value: 'coins' as const, label: <T k="map.sizeBy.coins" /> },
                  { value: 'finds' as const, label: <T k="map.sizeBy.finds" /> },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2 map-filter-section">
            <p className="text-sm leading-snug text-gray-700">
              {typeEntries.length === 0 ? (
                <T k="map.currentView.mintTownDbNone" />
              ) : (
                <T
                  k={viewMode === 'compare' ? 'map.currentView.mintTownDbActiveCompare' : 'map.currentView.mintTownDbActiveOr'}
                />
              )}{' '}
              <ClickHint
                hint={
                  <T
                    k="visualizations.mintsPlotted"
                    vars={{ plotted: plottedSummary.plotted, total: plottedSummary.total }}
                  />
                }
                className="inline-flex cursor-help text-gray-400 hover:text-gray-600"
              >
                <QuestionCircleIcon />
              </ClickHint>
            </p>
            <TypologyMultiSelect
              staged={stagedType}
              onStagedChange={setStagedType}
              committedEntries={typeCommittedEntries}
              colorByValue={typeColorByValue}
              onAddAnother={addAnotherTypeEntry}
              onRemove={removeTypeEntry}
              onClear={clearTypeEntries}
              onClearFilters={clearFilters}
              filterActive={filterActive}
              hierarchyRows={hierarchyRows}
              coinIssues={coinIssues}
              optionCounts={typeOptionCounts}
            />
          </div>

          {mintPoints.length === 0 && (
            <p className="text-sm text-gray-700">
              <T k="visualizations.noMappedMints" />
            </p>
          )}

          {filterActive && foundInSummary && (
            <p className="text-sm text-gray-700">
              <T
                k="heatmap.foundInMints"
                vars={{
                  found: foundInSummary.foundCount,
                  total: foundInSummary.totalCount,
                  plotted: foundInSummary.plottedCount,
                }}
              />
            </p>
          )}
        </div>
      </MapVisualizationOverlay>

      {(filterActive || viewMode === 'density' || viewMode === 'compare') && (
        <div className="heatmap_legend">
          {viewMode === 'compare' && (
            <CompareLegend titleKey="map.legend.byType" entries={typeEntries} colorByValue={typeColorByValue} />
          )}
          {filterActive && viewMode === 'points' && (
            <RatioLegend
              noData={
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full map-legend-swatch-no-data" />
                  <T k="heatmap.legend.noData" />
                </span>
              }
            />
          )}
          {viewMode === 'density' && <DensityLegend range={density.range} />}
        </div>
      )}
    </div>
  )
}

/* ── Museum Collections (ANS specimens) ─────────────────────────────────── */

type MuseumTab = 'mint' | 'search'

/** Same floating card chrome as MapVisualizationOverlay (collapse toggle at
 * every breakpoint included), with its own top-level tab row — Mint Town
 * (the map filter controls) vs Search (accession-number lookup) — playing
 * the same role its Mint Town / Find Site tabs play on the map visualizations page,
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
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  // Desktop has room for the panel to sit open by default (unlike mobile/
  // tablet, where it starts collapsed so the map stays reachable). Not in
  // the initial useState — that would mismatch the server-rendered
  // "closed" HTML. Museum Collections is a single page (no tab-driven
  // remount like MapVisualizationOverlay's Mint Town/Find Site routes), so
  // this only ever needs to run once, with no cross-mount guard.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) setOpen(true)
  }, [])

  return (
    <div className={`map-vis-overlay ${open ? '' : 'map-vis-overlay-collapsed'}`}>
      <div className="map-vis-panel">
        <div className="map-vis-panel-header">
          <ClickHint hint={t('nav.spadeHeatmapHint')} className="shrink-0 hint-underline text-sm font-semibold text-gray-700">
            <T k="nav.spadeHeatmap" />
          </ClickHint>

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

        <div className={`map-vis-panel-body museum-panel-body ${open ? 'block' : 'hidden'}`}>
          <div className="map-vis-panel-body-header">
            <ClickHint hint={t('visualizations.viewByLabelHint.museum')} className="shrink-0 hint-underline text-sm font-semibold text-gray-700">
              <T k="visualizations.viewByLabel" />
            </ClickHint>
            <ToggleButtons
              value={tab}
              onChange={onTabChange}
              options={[
                { value: 'mint' as const, label: <T k="visualizations.tabs.mintTown" /> },
                { value: 'search' as const, label: <T k="museum.tabs.search" /> },
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
 * instead of database finds. See computeAnsMintStats / getMatchingAnsSpecimensMulti
 * in lib/mint-stats.ts for how the two data sources diverge under
 * the hood while sharing this same rendering. Its Search tab
 * (AccessionNumberSearch) looks up specimens by accession number instead.
 */
export function AnsMintTownVisualization({
  specimens,
  coinIssues,
  hierarchyRows,
  mints,
  initialViewMode,
  initialTypeSelections,
}: {
  specimens: AnsSpecimen[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
  mints: MintInfo[]
  /** Pre-built filter state for a deep link — see FindSpotsVisualization's
   * matching props. */
  initialViewMode?: ViewMode
  initialTypeSelections?: TypologyFilterSelection[]
}) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<MuseumTab>('mint')
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? 'points')
  const [showNoData, setShowNoData] = useState(true)
  const [showMinorRivers, setShowMinorRivers] = useState(false)
  const [showRoutes, setShowRoutes] = useState(false)
  // Scopes the inscription filter (dropdown options + its count) to
  // inscriptions actually present among these specimens, instead of every
  // inscription in the sitewide coin_issues catalog — see
  // buildAnsInscriptionSource's doc comment.
  const inscriptionSource = useMemo(() => buildAnsInscriptionSource(specimens, coinIssues), [specimens, coinIssues])
  const {
    staged: stagedType,
    setStaged: setStagedType,
    entries: typeEntries,
    committedEntries: typeCommittedEntries,
    colorByValue: typeColorByValue,
    addAnother: addAnotherTypeEntry,
    remove: removeTypeEntry,
    clear: clearTypeEntries,
  } = useTypologyMultiSelect(inscriptionSource, hierarchyRows, initialTypeSelections)

  const typeOptionCounts = useMemo(
    () => buildAnsTypologyMintCounts(specimens, hierarchyRows, stagedType),
    [specimens, hierarchyRows, stagedType]
  )
  // Order of selection (not of `specimens`) so each pick keeps its color
  // slot as later picks are added/removed around it. Keyed by ans_data.id —
  // catalog_number isn't unique (some specimens share an accession number).
  const {
    selected: selectedOrder,
    colorByValue: selectedColorById,
    toggle: toggleSelected,
    clear: clearSelected,
  } = useSelectionColors()

  const filterActive = typeEntries.length > 0

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
        const mint = specimen.mint_zh ? findMintByNameZh(mints, specimen.mint_zh) : undefined
        if (mint?.lat == null || mint?.lng == null) return []
        return [
          {
            key: specimen.id,
            lat: mint.lat,
            lng: mint.lng,
            color,
            label: specimen.catalog_number ?? specimen.id,
            href: specimen.catalog_number ? ansCollectionUrl(specimen.catalog_number) : undefined,
          },
        ]
      }),
    [selectedSpecimens, mints]
  )

  const matchedSpecimens = useMemo(
    () => getMatchingAnsSpecimensMulti(specimens, hierarchyRows, typeEntries),
    [specimens, hierarchyRows, typeEntries]
  )

  const totalStats = useMemo(() => computeAnsMintStats(specimens, mints), [specimens, mints])
  const matchedStats = useMemo(
    () => computeAnsMintStats(matchedSpecimens ?? [], mints),
    [matchedSpecimens, mints]
  )

  const mintPoints = useMemo(() => toMintPoints(totalStats.mapped), [totalStats])

  const mintStates = useMemo(() => {
    if (!matchedSpecimens) return null
    const matchedByMint = new Map(matchedStats.mapped.map((m) => [m.mint_zh, m]))
    const states = new Map<string, SiteHeatState>()
    totalStats.mapped.forEach((mint) => {
      const total = mint.coinCount
      const matched = matchedByMint.get(mint.mint_zh)
      const matchedCoins = matched?.coinCount ?? 0
      if (matchedCoins <= 0) {
        states.set(mint.mint_zh, { kind: 'no-data' })
        return
      }
      if (matchedCoins >= total) {
        states.set(mint.mint_zh, { kind: 'pure' })
        return
      }
      states.set(mint.mint_zh, {
        kind: 'ratio',
        ratio: matchedCoins / total,
        matchedQty: matchedCoins,
        totalQty: total,
        contextCount: 1,
        // ANS treats each specimen as one find, so findCount === coinCount.
        matchedFindCount: matched?.findCount ?? matchedCoins,
      })
    })
    return states
  }, [matchedSpecimens, matchedStats, totalStats])

  const density = useMemo(() => {
    const points = mintPoints.map((mint) => {
      const state: SiteHeatState = mintStates?.get(mint.mint_zh) ?? { kind: 'no-filter' }
      const { coins } = mintSizeMetrics(mint, state)
      return { lat: mint.lat, lng: mint.lng, weight: heatWeight(state, coins) }
    })
    return buildDensityLayer(points)
  }, [mintPoints, mintStates])

  // Counts across every documented mint (mapped + unmapped), not just the
  // ones with coordinates to plot — `plottedCount` then narrows that down to
  // how many of the matches actually show up as points on the map.
  const foundInSummary = useMemo(() => {
    if (!mintStates) return null
    const plottedCount = [...mintStates.values()].filter((s) => s.kind !== 'no-data').length
    const foundCount = [...matchedStats.mapped, ...matchedStats.unmapped].filter((m) => m.coinCount > 0).length
    return { foundCount, totalCount: totalStats.mapped.length + totalStats.unmapped.length, plottedCount }
  }, [mintStates, matchedStats, totalStats])

  const plottedSummary = useMemo(
    () => ({ plotted: totalStats.mapped.length, total: totalStats.mapped.length + totalStats.unmapped.length }),
    [totalStats]
  )

  // Compare view: one point per (mint, type) that has a nonzero matching
  // quantity, colored by that type's identity color — a mint matching two
  // selected types shows up twice here.
  const mintTypeQuantities = useMemo(() => {
    if (viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeAnsMintTypeQuantities(specimens, hierarchyRows, typeEntries)
  }, [viewMode, specimens, hierarchyRows, typeEntries])

  const comparePoints = useMemo<ComparePoint[]>(() => {
    if (viewMode !== 'compare') return []
    const points: ComparePoint[] = []
    typeEntries.forEach((entry) => {
      const color = typeColorByValue.get(entry.key) ?? SELECTION_COLORS[0]
      mintTypeQuantities.forEach((byEntry, mintZh) => {
        const qty = byEntry.get(entry.key)
        if (!qty) return
        const mint = mintPoints.find((m) => m.mint_zh === mintZh)
        if (!mint) return
        points.push({
          key: `${mintZh}::${entry.key}`,
          groupKey: mintZh,
          lat: mint.lat,
          lng: mint.lng,
          color,
          qty,
          locationLabel: `${mint.mint_zh}${mint.mint_en ? ` (${mint.mint_en})` : ''}`,
          groupLabel: entry.label,
          groupKindLabel: t('map.compare.typeKindLabel'),
          href: mint.mint_code ? `/mints/${mint.mint_code}` : undefined,
        })
      })
    })
    return points
  }, [viewMode, typeEntries, typeColorByValue, mintTypeQuantities, mintPoints, t])

  function clearFilters() {
    clearTypeEntries()
  }

  return (
    <div className="absolute inset-0">
      <MapVisCanvas
        kind="mints"
        mintPoints={mintPoints}
        mintStates={mintStates}
        viewMode={viewMode}
        densityLatLngs={density.latLngs}
        filterActive={filterActive}
        showNoData={showNoData}
        showMinorRivers={showMinorRivers}
        showRoutes={showRoutes}
        pins={pins}
        comparePoints={comparePoints}
      />

      <MuseumMapOverlay tab={tab} onTabChange={setTab}>
        {tab === 'search' ? (
          <AccessionNumberSearch
            specimens={specimens}
            mints={mints}
            inscriptionSource={inscriptionSource}
            selectedKeys={selectedKeys}
            selectedSpecimens={selectedSpecimens}
            onToggle={toggleSelected}
            onClear={clearSelected}
          />
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-2 map-display-section">
              <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare />

              <div className="filter-row">
                <ToggleChip active={showMinorRivers} onClick={() => setShowMinorRivers((v) => !v)}>
                  <T k="map.layers.minorRivers" />
                </ToggleChip>
                <ToggleChip
                  active={showRoutes}
                  onClick={() => setShowRoutes((v) => !v)}
                  title={t('map.layers.routesHint')}
                >
                  <T k="map.layers.routes" />
                </ToggleChip>
                <ToggleChip active={showNoData} onClick={() => setShowNoData((v) => !v)}>
                  <T k="map.filter.noDataToggle" />
                </ToggleChip>
              </div>
            </div>

            <div className="space-y-2 map-filter-section">
              <p className="text-sm leading-snug text-gray-700">
                {typeEntries.length === 0 ? (
                  <T k="map.currentView.mintTownAnsNone" vars={{ count: specimens.length }} />
                ) : (
                  <T
                    k={
                      viewMode === 'compare'
                        ? 'map.currentView.mintTownAnsActiveCompare'
                        : 'map.currentView.mintTownAnsActiveOr'
                    }
                  />
                )}{' '}
                <ClickHint
                  hint={
                    <T
                      k="visualizations.mintsPlotted"
                      vars={{ plotted: plottedSummary.plotted, total: plottedSummary.total }}
                    />
                  }
                  className="inline-flex cursor-help text-gray-400 hover:text-gray-600"
                >
                  <QuestionCircleIcon />
                </ClickHint>
              </p>
              <TypologyMultiSelect
                staged={stagedType}
                onStagedChange={setStagedType}
                committedEntries={typeCommittedEntries}
                colorByValue={typeColorByValue}
                onAddAnother={addAnotherTypeEntry}
                onRemove={removeTypeEntry}
                onClear={clearTypeEntries}
                onClearFilters={clearFilters}
                filterActive={filterActive}
                hierarchyRows={hierarchyRows}
                coinIssues={inscriptionSource}
                optionCounts={typeOptionCounts}
              />
            </div>

            {mintPoints.length === 0 && (
              <p className="text-sm text-gray-700">
                <T k="visualizations.noMappedMints" />
              </p>
            )}

            {filterActive && foundInSummary && (
              <p className="text-sm text-gray-700">
                <T
                  k="heatmap.foundInMints"
                  vars={{
                    found: foundInSummary.foundCount,
                    total: foundInSummary.totalCount,
                    plotted: foundInSummary.plottedCount,
                  }}
                />
              </p>
            )}
          </div>
        )}
      </MuseumMapOverlay>

      {tab === 'mint' && (filterActive || viewMode === 'density' || viewMode === 'compare') && (
        <div className="heatmap_legend">
          {viewMode === 'compare' && (
            <CompareLegend titleKey="map.legend.byType" entries={typeEntries} colorByValue={typeColorByValue} />
          )}
          {filterActive && viewMode === 'points' && (
            <RatioLegend
              noData={
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full map-legend-swatch-no-data" />
                  <T k="heatmap.legend.noData" />
                </span>
              }
            />
          )}
          {viewMode === 'density' && <DensityLegend range={density.range} />}
        </div>
      )}
    </div>
  )
}
