import { resolveMintNameZh } from '@/lib/mint-towns'
import { splitCsv } from '@/lib/format'
import type { CoinIssueDisplay, CoinTypeHierarchyRow, HeatmapFind } from '@/lib/types'

/**
 * Selection through the live coin_type_hierarchy tree. level1 is a real,
 * meaningful choice — NOT always '钱币' (Coin): '钱范' (Coin Mould) is its
 * own top-level category with major/minor type one level shallower (see
 * majorDepth below). level1..level5 hold the zh label chosen at each depth
 * (empty string = unset; levels are meaningful only contiguously — level3
 * is ignored unless level2 is also set, etc). inscriptionId is a
 * coin_issues.inscription_id, not text, since that's already a stable id
 * available on every coin.
 */
export type TypologyFilterSelection = {
  level1: string
  level2: string
  level3: string
  level4: string
  level5: string
  inscriptionId: string
}

export function emptyTypologySelection(): TypologyFilterSelection {
  return { level1: '', level2: '', level3: '', level4: '', level5: '', inscriptionId: '' }
}

export function hasTypologyFilter(sel: TypologyFilterSelection): boolean {
  return !!sel.level1 || !!sel.inscriptionId
}

/**
 * One confirmed pick in a multiselect coin-type filter (Find Site's "by
 * type" mode, the database Mint Town tab, Museum Collections' Mint Town
 * view) — the hierarchical picker (TypologyFilterBar) only ever stages one
 * `TypologyFilterSelection` at a time, so these accumulate as the user adds
 * picks, each keeping its own identity color and chip.
 */
export type TypologySelectionEntry = {
  /** Stable identity for color-slot tracking, React keys, and dedup —
   * `typologySelectionKey(sel)`. */
  key: string
  sel: TypologyFilterSelection
  /** Human-readable label for the chip/legend, e.g. "布币 › 平首布" or an
   * inscription's own zh text — see describeTypologySelection. */
  label: string
}

/** Canonical string form of a selection, stable across renders — used both
 * as the color-slot id and to dedupe against picks already in the list.
 * Joined with '|' (not '') since level labels are free-text zh strings
 * that could otherwise collide across level boundaries. */
export function typologySelectionKey(sel: TypologyFilterSelection): string {
  return [sel.level1, sel.level2, sel.level3, sel.level4, sel.level5, sel.inscriptionId].join('|')
}

/** Human-readable label for a staged selection: its level path (if any),
 * plus its inscription's zh text (if any) — whichever parts are set. */
export function describeTypologySelection(sel: TypologyFilterSelection, coinIssues: CoinIssueDisplay[]): string {
  const path = [sel.level1, sel.level2, sel.level3, sel.level4, sel.level5].filter(Boolean)
  let label = path.join(' › ')
  if (sel.inscriptionId) {
    const inscription = coinIssues.find((c) => c.inscription_id === sel.inscriptionId)?.inscription
    if (inscription) label = label ? `${label} · ${inscription}` : inscription
  }
  return label
}

const LEVEL_KEYS: Array<keyof Pick<TypologyFilterSelection, 'level1' | 'level2' | 'level3' | 'level4' | 'level5'>> = [
  'level1',
  'level2',
  'level3',
  'level4',
  'level5',
]

/** A hierarchy row's own path, trimmed at the first unset level (level1 is
 * never null; once a deeper level is null, every level below it is null
 * too). */
function rowPath(row: CoinTypeHierarchyRow): string[] {
  const path: string[] = []
  const values = [row.level1_zh, row.level2_zh, row.level3_zh, row.level4_zh, row.level5_zh]
  for (const v of values) {
    if (!v) break
    path.push(v)
  }
  return path
}

/** The selected path, stopping at the first unset level (selection is only
 * meaningful contiguously from level1). */
function selectionPath(sel: TypologyFilterSelection): string[] {
  const path: string[] = []
  for (const key of LEVEL_KEYS) {
    const v = sel[key]
    if (!v) break
    path.push(v)
  }
  return path
}

function pathStartsWith(path: string[], prefix: string[]): boolean {
  if (prefix.length > path.length) return false
  return prefix.every((v, i) => path[i] === v)
}

/**
 * Every coin_type_hierarchy row id whose own path (a specific leaf, or a
 * "generic bucket" row with trailing nulls) starts with the selected path —
 * this single prefix rule covers both a node's own generic-bucket row (if
 * one exists) and every deeper descendant, with no alias table needed:
 * both the selection and the rows being matched come from the same table.
 */
export function getMatchingHierarchyIds(
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): Set<string> | null {
  const prefix = selectionPath(sel)
  if (prefix.length === 0) return null
  const ids = new Set<string>()
  hierarchyRows.forEach((row) => {
    if (pathStartsWith(rowPath(row), prefix)) ids.add(row.id)
  })
  return ids
}

export function coinMatchesTypologyFilter(
  coin: Pick<CoinIssueDisplay, 'coin_type_hierarchy_id' | 'inscription_id'>,
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): boolean {
  if (!sel.level1) {
    if (!sel.inscriptionId) return false
    return coin.inscription_id === sel.inscriptionId
  }

  const matchedIds = getMatchingHierarchyIds(hierarchyRows, sel)
  if (!matchedIds || !coin.coin_type_hierarchy_id || !matchedIds.has(coin.coin_type_hierarchy_id)) return false

  if (sel.inscriptionId) return coin.inscription_id === sel.inscriptionId
  return true
}

/** Returns matching coin_issues.id values (match against HeatmapFind.
 * coin_issues_id, never coin_type_code), or null when no typology filter is
 * active. */
export function getMatchingCoinIssueIds(
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): Set<string> | null {
  if (!hasTypologyFilter(sel)) return null
  return new Set(coinIssues.filter((c) => coinMatchesTypologyFilter(c, hierarchyRows, sel)).map((c) => c.id))
}

type SiteLevelFields = {
  level1_types_zh: string | null
  level2_types_zh: string | null
  level3_types_zh: string | null
  level4_types_zh: string | null
  level5_types_zh: string | null
  inscriptions: string | null
}

/** The deepest level set in `sel`, and its value — v_coin_map_sites carries
 * one CSV column per level, so a selection at depth N is matched directly
 * against that site's levelN_types_zh, no derivation needed. */
function deepestSelectedLevel(sel: TypologyFilterSelection): { depth: 1 | 2 | 3 | 4 | 5; value: string } | null {
  for (let i = LEVEL_KEYS.length - 1; i >= 0; i--) {
    const value = sel[LEVEL_KEYS[i]]
    if (value) return { depth: (i + 1) as 1 | 2 | 3 | 4 | 5, value }
  }
  return null
}

/**
 * Site-aggregate match for the homepage CoinFilterMap (CSV text fields on
 * MapSite). Sites only carry text, not hierarchy ids, so an inscription-only
 * selection needs its zh text resolved by the caller (from the same
 * inscription option list the UI already fetched) and passed as
 * `inscriptionZh`.
 */
export function siteMatchesTypologyFilter(
  site: SiteLevelFields,
  sel: TypologyFilterSelection,
  inscriptionZh: string | null
): boolean {
  const deepest = deepestSelectedLevel(sel)
  if (!deepest) {
    if (!sel.inscriptionId) return false
    return !!inscriptionZh && splitCsv(site.inscriptions).includes(inscriptionZh)
  }

  const siteValues = splitCsv(site[`level${deepest.depth}_types_zh` as const])
  if (!siteValues.includes(deepest.value)) return false

  if (sel.inscriptionId) {
    return !!inscriptionZh && splitCsv(site.inscriptions).includes(inscriptionZh)
  }
  return true
}

export function optionLabel(en: string, zh: string, lang: 'en' | 'zh'): string {
  if (lang === 'zh' && zh) return zh
  if (en && zh) return `${en} · ${zh}`
  return en || zh
}

export type HierarchyLevelOption = { value: string; label_zh: string; label_en: string }

/** The selected path up to (but not including) `depth`, or null if a
 * shallower level hasn't been picked yet (so this depth's options aren't
 * meaningful yet). depth=1 always resolves to []. */
function prefixUpTo(sel: TypologyFilterSelection, depth: 1 | 2 | 3 | 4 | 5): string[] | null {
  const prefix: string[] = []
  for (let i = 0; i < depth - 1; i++) {
    const v = sel[LEVEL_KEYS[i]]
    if (!v) return null
    prefix.push(v)
  }
  return prefix
}

/**
 * Distinct (zh, en) label options at `depth` among hierarchy rows whose
 * shallower levels match `sel` — the DB-backed replacement for the old
 * static tree's getL1Options..getL4Options. depth=1 lists the top-level
 * branches (钱币 / 钱范) with no selection required.
 */
export function getLevelOptions(
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection,
  depth: 1 | 2 | 3 | 4 | 5
): HierarchyLevelOption[] {
  const prefix = prefixUpTo(sel, depth)
  if (prefix === null) return []

  const zhKey = `level${depth}_zh` as const
  const enKey = `level${depth}_en` as const
  const seen = new Map<string, HierarchyLevelOption>()
  hierarchyRows.forEach((row) => {
    if (!pathStartsWith(rowPath(row), prefix)) return
    const zh = row[zhKey]
    if (!zh || seen.has(zh)) return
    seen.set(zh, { value: zh, label_zh: zh, label_en: row[enKey] ?? zh })
  })
  return [...seen.values()].sort((a, b) => a.label_zh.localeCompare(b.label_zh, 'zh-CN'))
}

export type InscriptionOption = {
  id: string
  zh: string
  en: string
  mint_zh: string | null
}

/**
 * Inscription choices for the current type selection, live from coin_issues
 * — dedupe by inscription_id among coins matching the current level1..level5
 * selection (ignoring any inscription already picked, so the list always
 * covers the whole type selection). With no type picked yet, every
 * inscription across all coin_issues is offered, so a user can jump
 * straight to filtering by inscription.
 */
export function getInscriptionOptions(
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): InscriptionOption[] {
  const typeOnly: TypologyFilterSelection = { ...sel, inscriptionId: '' }
  const seen = new Map<string, InscriptionOption>()
  coinIssues.forEach((coin) => {
    if (!coin.inscription_id || !coin.inscription) return
    if (sel.level1 && !coinMatchesTypologyFilter(coin, hierarchyRows, typeOnly)) return
    if (seen.has(coin.inscription_id)) return
    seen.set(coin.inscription_id, {
      id: coin.inscription_id,
      zh: coin.inscription,
      en: coin.inscription_en ?? coin.inscription,
      mint_zh: coin.mint_zh,
    })
  })
  return [...seen.values()].sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))
}

/** Coin_issues.id values matching ANY entry (OR logic, for Points/Density
 * multiselect), or null when `entries` is empty (no filter active). */
export function getMatchingCoinIssueIdsMulti(
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  entries: TypologySelectionEntry[]
): Set<string> | null {
  if (entries.length === 0) return null
  const result = new Set<string>()
  coinIssues.forEach((c) => {
    if (entries.some((entry) => coinMatchesTypologyFilter(c, hierarchyRows, entry.sel))) result.add(c.id)
  })
  return result
}

function matchedIdsPerEntry(
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  entries: TypologySelectionEntry[]
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  entries.forEach((entry) => {
    result.set(entry.key, getMatchingCoinIssueIds(coinIssues, hierarchyRows, entry.sel) ?? new Set())
  })
  return result
}

function findQuantity(find: HeatmapFind): number {
  if (find.quantity_total != null) return find.quantity_total
  if (find.quantity_estimated != null) return find.quantity_estimated
  if (find.quantity_min != null) return find.quantity_min
  return find.presence ? 1 : 0
}

/** Per-site, per-selection-entry coin quantities for Compare mode — outer
 * key is site_code, inner key is entry.key. Used by Find Site's "by type"
 * Compare view (one point per site per matching entry). */
export function computeSiteTypeQuantities(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  entries: TypologySelectionEntry[]
): Map<string, Map<string, number>> {
  const idsByEntry = matchedIdsPerEntry(coinIssues, hierarchyRows, entries)
  const result = new Map<string, Map<string, number>>()
  finds.forEach((find) => {
    if (!find.site_code || !find.coin_issues_id) return
    const qty = findQuantity(find)
    if (qty <= 0) return
    entries.forEach((entry) => {
      if (!idsByEntry.get(entry.key)!.has(find.coin_issues_id!)) return
      if (!result.has(find.site_code)) result.set(find.site_code, new Map())
      const bySite = result.get(find.site_code)!
      bySite.set(entry.key, (bySite.get(entry.key) ?? 0) + qty)
    })
  })
  return result
}

/** Per-mint, per-selection-entry coin quantities for Compare mode — outer
 * key is the resolved mint zh name, inner key is entry.key. Used by the
 * database Mint Town tab's "by type" Compare view. */
export function computeMintTypeQuantities(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  entries: TypologySelectionEntry[]
): Map<string, Map<string, number>> {
  const idsByEntry = matchedIdsPerEntry(coinIssues, hierarchyRows, entries)
  const coinIssueById = new Map(coinIssues.map((c) => [c.id, c]))
  const result = new Map<string, Map<string, number>>()
  finds.forEach((find) => {
    if (!find.coin_issues_id) return
    const coinIssue = coinIssueById.get(find.coin_issues_id)
    const mintRaw = coinIssue?.mint_zh?.trim()
    if (!mintRaw) return
    const mintZh = resolveMintNameZh(mintRaw)
    const qty = findQuantity(find)
    if (qty <= 0) return
    entries.forEach((entry) => {
      if (!idsByEntry.get(entry.key)!.has(find.coin_issues_id!)) return
      if (!result.has(mintZh)) result.set(mintZh, new Map())
      const byMint = result.get(mintZh)!
      byMint.set(entry.key, (byMint.get(entry.key) ?? 0) + qty)
    })
  })
  return result
}
