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
} from '@/lib/mint-filter'
import { getMintByNameZh } from '@/lib/mint-towns'
import {
  ansCollectionUrl,
  computeAnsMintStats,
  computeAnsMintTypeQuantities,
  computeMintStatsFromFinds,
  getMatchingAnsSpecimensMulti,
  toMintPoints,
  type AnsSpecimen,
  type HeatmapSource,
} from '@/lib/pointed-spade-data'
import {
  computeMintTypeQuantities,
  computeSiteTypeQuantities,
  describeTypologySelection,
  emptyTypologySelection,
  getMatchingCoinIssueIdsMulti,
  hasTypologyFilter,
  typologySelectionKey,
  type TypologyFilterSelection,
  type TypologySelectionEntry,
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
      <span className="font-semibold uppercase tracking-wide text-gray-500">
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
function buildInitialTypologyState(coinIssues: CoinIssueDisplay[], initialSelections: TypologyFilterSelection[]) {
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
    labelByKey.set(key, describeTypologySelection(sel, coinIssues))
  })
  return { order, slotById, selByKey, labelByKey }
}

function useTypologyMultiSelect(coinIssues: CoinIssueDisplay[], initialSelections: TypologyFilterSelection[] = []) {
  const [staged, setStagedRaw] = useState<TypologyFilterSelection>(emptyTypologySelection())
  const [initial] = useState(() => buildInitialTypologyState(coinIssues, initialSelections))
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

  const colorByValue = useMemo(() => {
    const map = new Map<string, string>()
    order.forEach((key) => map.set(key, SELECTION_COLORS[(slotById.get(key) ?? 0) % SELECTION_COLORS.length]))
    if (stagedKey && stagedSlot !== null && !map.has(stagedKey)) {
      map.set(stagedKey, SELECTION_COLORS[stagedSlot % SELECTION_COLORS.length])
    }
    return map
  }, [order, slotById, stagedKey, stagedSlot])

  const entries = useMemo<TypologySelectionEntry[]>(() => {
    if (!stagedKey || order.includes(stagedKey)) return committedEntries
    return [...committedEntries, { key: stagedKey, sel: staged, label: describeTypologySelection(staged, coinIssues) }]
  }, [committedEntries, stagedKey, order, staged, coinIssues])

  function addAnother() {
    if (!stagedKey || stagedSlot === null) return
    if (!order.includes(stagedKey)) {
      setOrder((prev) => [...prev, stagedKey])
      setSlotById((prev) => new Map(prev).set(stagedKey, stagedSlot))
      setSelByKey((prev) => new Map(prev).set(stagedKey, staged))
      setLabelByKey((prev) => new Map(prev).set(stagedKey, describeTypologySelection(staged, coinIssues)))
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
  hierarchyRows,
  coinIssues,
}: {
  staged: TypologyFilterSelection
  onStagedChange: (sel: TypologyFilterSelection) => void
  committedEntries: TypologySelectionEntry[]
  colorByValue: Map<string, string>
  onAddAnother: () => void
  onRemove: (key: string) => void
  onClear: () => void
  hierarchyRows: CoinTypeHierarchyRow[]
  coinIssues: CoinIssueDisplay[]
}) {
  const { t } = useLanguage()
  const canAddAnother = hasTypologyFilter(staged) && !committedEntries.some((e) => e.key === typologySelectionKey(staged))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <TypologyFilterBar
          sel={staged}
          onChange={onStagedChange}
          showInscriptionList
          hierarchyRows={hierarchyRows}
          coinIssues={coinIssues}
          compact
        />
        <button
          type="button"
          onClick={onAddAnother}
          disabled={!canAddAnother}
          className="rounded border border-brand/30 bg-brand-light px-2.5 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand-light disabled:hover:text-brand"
        >
          <T k="map.filter.addSelection" />
        </button>
      </div>

      {committedEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
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
          <button type="button" onClick={onClear} className="text-xs font-semibold text-brand hover:underline">
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
  initialMode,
  initialViewMode,
  initialMintNames,
  initialTypeSelections,
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
  const {
    staged: stagedType,
    setStaged: setStagedType,
    entries: typeEntries,
    committedEntries: typeCommittedEntries,
    colorByValue: typeColorByValue,
    addAnother: addAnotherTypeEntry,
    remove: removeTypeEntry,
    clear: clearTypeEntries,
  } = useTypologyMultiSelect(coinIssues, initialTypeSelections)

  const mintOptions = useMemo(() => buildMintFilterOptions(coinIssues, finds), [coinIssues, finds])
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

  // Compare view: one point per (site, mint) or (site, type) that has a
  // nonzero matching quantity, colored by that group's identity color —
  // unlike points/density (which OR the selection into one match-ratio per
  // site), a site matching two selected groups shows up twice here.
  const siteMintQuantities = useMemo(() => {
    if (mode !== 'mint' || viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeSiteMintQuantities(finds, coinIssues, mintFilters)
  }, [mode, viewMode, finds, coinIssues, mintFilters])

  const siteTypeQuantities = useMemo(() => {
    if (mode !== 'type' || viewMode !== 'compare') return new Map<string, Map<string, number>>()
    return computeSiteTypeQuantities(finds, coinIssues, hierarchyRows, typeEntries)
  }, [mode, viewMode, finds, coinIssues, hierarchyRows, typeEntries])

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
              }}
              options={[
                { value: 'type' as const, label: <T k="map.filter.byType" /> },
                { value: 'mint' as const, label: <T k="map.filter.byMint" /> },
              ]}
            />
          </div>

          <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare />

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
          <MapExplanation viewMode={viewMode} />

          {mode === 'type' && (
            <TypologyMultiSelect
              staged={stagedType}
              onStagedChange={setStagedType}
              committedEntries={typeCommittedEntries}
              colorByValue={typeColorByValue}
              onAddAnother={addAnotherTypeEntry}
              onRemove={removeTypeEntry}
              onClear={clearTypeEntries}
              hierarchyRows={hierarchyRows}
              coinIssues={coinIssues}
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
  initialViewMode,
  initialTypeSelections,
}: {
  finds: HeatmapFind[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
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
  const {
    staged: stagedType,
    setStaged: setStagedType,
    entries: typeEntries,
    committedEntries: typeCommittedEntries,
    colorByValue: typeColorByValue,
    addAnother: addAnotherTypeEntry,
    remove: removeTypeEntry,
    clear: clearTypeEntries,
  } = useTypologyMultiSelect(coinIssues, initialTypeSelections)

  const filterActive = typeEntries.length > 0

  const matchedIds = useMemo(
    () => getMatchingCoinIssueIdsMulti(coinIssues, hierarchyRows, typeEntries),
    [coinIssues, hierarchyRows, typeEntries]
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
        densityLatLngs={densityLatLngs}
        comparePoints={comparePoints}
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

          <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare />

          <p className="text-sm leading-snug text-gray-700">
            {typeEntries.length === 0 ? (
              <T k="map.currentView.mintTownDbNone" />
            ) : (
              <T
                k={viewMode === 'compare' ? 'map.currentView.mintTownDbActiveCompare' : 'map.currentView.mintTownDbActiveOr'}
              />
            )}
          </p>
          <MapExplanation viewMode={viewMode} />
          <p className="text-sm text-gray-700">
            <T
              k="visualizations.mintsPlotted"
              vars={{ plotted: plottedSummary.plotted, total: plottedSummary.total }}
            />
          </p>
          <TypologyMultiSelect
            staged={stagedType}
            onStagedChange={setStagedType}
            committedEntries={typeCommittedEntries}
            colorByValue={typeColorByValue}
            onAddAnother={addAnotherTypeEntry}
            onRemove={removeTypeEntry}
            onClear={clearTypeEntries}
            hierarchyRows={hierarchyRows}
            coinIssues={coinIssues}
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

      {(filterActive || viewMode === 'density' || viewMode === 'compare') && (
        <div className="heatmap_legend">
          {viewMode === 'compare' && (
            <CompareLegend titleKey="map.legend.byType" entries={typeEntries} colorByValue={typeColorByValue} />
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
 * instead of database finds. See computeAnsMintStats / getMatchingAnsSpecimensMulti
 * in lib/pointed-spade-data.ts for how the two data sources diverge under
 * the hood while sharing this same rendering. Its Search tab
 * (AccessionNumberSearch) looks up specimens by accession number instead.
 */
export function AnsMintTownVisualization({
  specimens,
  coinIssues,
  hierarchyRows,
  initialViewMode,
  initialTypeSelections,
}: {
  specimens: AnsSpecimen[]
  coinIssues: CoinIssueDisplay[]
  hierarchyRows: CoinTypeHierarchyRow[]
  /** Pre-built filter state for a deep link — see FindSpotsVisualization's
   * matching props. */
  initialViewMode?: ViewMode
  initialTypeSelections?: TypologyFilterSelection[]
}) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<MuseumTab>('mint')
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? 'points')
  const {
    staged: stagedType,
    setStaged: setStagedType,
    entries: typeEntries,
    committedEntries: typeCommittedEntries,
    colorByValue: typeColorByValue,
    addAnother: addAnotherTypeEntry,
    remove: removeTypeEntry,
    clear: clearTypeEntries,
  } = useTypologyMultiSelect(coinIssues, initialTypeSelections)
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
    () => getMatchingAnsSpecimensMulti(specimens, hierarchyRows, typeEntries),
    [specimens, hierarchyRows, typeEntries]
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
        densityLatLngs={densityLatLngs}
        pins={pins}
        comparePoints={comparePoints}
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
            <ViewModeRow viewMode={viewMode} onChange={setViewMode} showCompare />

            <p className="text-sm leading-snug text-gray-700">
              {typeEntries.length === 0 ? (
                <T k="map.currentView.mintTownAnsNone" />
              ) : (
                <T
                  k={
                    viewMode === 'compare'
                      ? 'map.currentView.mintTownAnsActiveCompare'
                      : 'map.currentView.mintTownAnsActiveOr'
                  }
                />
              )}
            </p>
            <MapExplanation viewMode={viewMode} />
            <p className="text-sm text-gray-700">
              <T
                k="visualizations.mintsPlotted"
                vars={{ plotted: plottedSummary.plotted, total: plottedSummary.total }}
              />
            </p>
            <TypologyMultiSelect
              staged={stagedType}
              onStagedChange={setStagedType}
              committedEntries={typeCommittedEntries}
              colorByValue={typeColorByValue}
              onAddAnother={addAnotherTypeEntry}
              onRemove={removeTypeEntry}
              onClear={clearTypeEntries}
              hierarchyRows={hierarchyRows}
              coinIssues={coinIssues}
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

      {tab === 'mint' && (filterActive || viewMode === 'density' || viewMode === 'compare') && (
        <div className="heatmap_legend">
          {viewMode === 'compare' && (
            <CompareLegend titleKey="map.legend.byType" entries={typeEntries} colorByValue={typeColorByValue} />
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
