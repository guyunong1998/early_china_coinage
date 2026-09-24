import { findQuantity } from '@/lib/quantity'
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

/** The fields describeTypologySelection/getInscriptionOptions actually need
 * — narrow enough that a caller can pass either the real coin_issues
 * catalog (Find Site, the database Mint Town tab) or a synthesized,
 * ans_data-scoped stand-in (Museum Collections' buildAnsInscriptionSource in
 * lib/mint-stats.ts) through the exact same functions. */
export type InscriptionSourceRow = Pick<
  CoinIssueDisplay,
  'inscription_id' | 'inscription' | 'inscription_en' | 'mint_zh' | 'coin_type_hierarchy_id'
>

/** Human-readable, bilingual label for a staged selection: the deepest
 * selected level's own name (not the full level1..level5 breadcrumb — that
 * hierarchy-depth split is an implementation detail, not something a chip
 * needs to spell out), plus its inscription (if any) — also bilingual. Both
 * getLevelOptions and selectionPath are defined further down this file but
 * usable here regardless (function declarations are hoisted). */
export function describeTypologySelection(
  sel: TypologyFilterSelection,
  coinIssues: InscriptionSourceRow[],
  hierarchyRows: CoinTypeHierarchyRow[]
): string {
  const path = selectionPath(sel)
  let label = ''
  if (path.length > 0) {
    const depth = path.length as 1 | 2 | 3 | 4 | 5
    const zh = path[path.length - 1]
    const option = getLevelOptions(hierarchyRows, sel, depth).find((o) => o.value === zh)
    const en = option?.label_en
    label = en && en !== zh ? `${zh} · ${en}` : zh
  }
  if (sel.inscriptionId) {
    const coin = coinIssues.find((c) => c.inscription_id === sel.inscriptionId)
    if (coin?.inscription) {
      const en = coin.inscription_en
      const inscriptionLabel = en && en !== coin.inscription ? `${coin.inscription} · ${en}` : coin.inscription
      label = label ? `${label} · ${inscriptionLabel}` : inscriptionLabel
    }
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

/** `coin_issues.legacy_type` is either one hierarchy label (蚁鼻钱) or the
 * old major,minor pair (刀币,齐大刀) joined with a comma. */
export function parseLegacyTypeTokens(legacyType: string | null | undefined): string[] {
  if (!legacyType) return []
  return legacyType
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Best coin_type_hierarchy row for a legacy_type string — used when
 * coin_issues.coin_type_hierarchy_id is still null but the type text is
 * already on legacy_type (the ~10 Shandong issues whose finds only have
 * coin_issues_id, never deprecated_coin_type_code).
 *
 * Prefers a row whose path ends on the last token (the leaf), then the
 * generic bucket (shortest path) so '圜钱' maps to the category row rather
 * than a random inscription-level child.
 */
export function matchHierarchyForLegacyType(
  legacyType: string | null | undefined,
  hierarchyRows: CoinTypeHierarchyRow[]
): CoinTypeHierarchyRow | null {
  const tokens = parseLegacyTypeTokens(legacyType)
  if (tokens.length === 0) return null
  const leaf = tokens[tokens.length - 1]

  const candidates = hierarchyRows.filter((row) => {
    const path = rowPath(row)
    if (!path.includes(leaf)) return false
    let i = 0
    for (const step of path) {
      if (step === tokens[i]) {
        i += 1
        if (i === tokens.length) return true
      }
    }
    return false
  })
  if (candidates.length === 0) return null

  const endingAtLeaf = candidates.filter((row) => {
    const path = rowPath(row)
    return path[path.length - 1] === leaf
  })
  const pool = endingAtLeaf.length > 0 ? endingAtLeaf : candidates
  pool.sort((a, b) => rowPath(a).length - rowPath(b).length)
  return pool[0] ?? null
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
  sel: TypologyFilterSelection,
  /** Optional precomputed hierarchy id set for `sel` — avoids re-scanning
   * `hierarchyRows` on every coin when the caller is filtering in a loop. */
  matchedHierarchyIds?: Set<string> | null
): boolean {
  if (!sel.level1) {
    if (!sel.inscriptionId) return false
    return coin.inscription_id === sel.inscriptionId
  }

  const matchedIds = matchedHierarchyIds ?? getMatchingHierarchyIds(hierarchyRows, sel)
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
  if (!sel.level1) {
    const ids = new Set<string>()
    for (const c of coinIssues) {
      if (c.inscription_id === sel.inscriptionId) ids.add(c.id)
    }
    return ids
  }
  // Compute hierarchy matches once — the previous filter()+coinMatches path
  // re-scanned hierarchyRows for every coin issue.
  const matchedHierarchyIds = getMatchingHierarchyIds(hierarchyRows, sel)
  if (!matchedHierarchyIds) return new Set()
  const ids = new Set<string>()
  for (const c of coinIssues) {
    if (!c.coin_type_hierarchy_id || !matchedHierarchyIds.has(c.coin_type_hierarchy_id)) continue
    if (sel.inscriptionId && c.inscription_id !== sel.inscriptionId) continue
    ids.add(c.id)
  }
  return ids
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
  coinIssues: InscriptionSourceRow[],
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

/** Per-option counts for the type filter dropdowns — the "(N)" hint shown
 * beside each level1..level5 and inscription option in TypologyFilterBar.
 * `level(depth, value)` counts matches for the current selection's prefix
 * up to `depth` with `value` at `depth` itself (deeper levels and
 * inscription ignored); `inscription(id)` counts matches for the current
 * full level selection plus that inscription. What "count" means (distinct
 * sites, distinct mint towns, ...) is up to whichever builder produced it —
 * see buildTypologySiteCounts and buildTypologyMintCounts below, and
 * buildAnsTypologyMintCounts in lib/mint-stats.ts for Museum Collections'
 * ans_data equivalent. */
export type TypologyOptionCounts = {
  level: (depth: 1 | 2 | 3 | 4 | 5, value: string) => number
  inscription: (inscriptionId: string) => number
}

/**
 * One-pass aggregation for dropdown option counts. The previous path called
 * getMatchingCoinIssueIds + a full finds scan once per option, which made
 * every typology dropdown change O(options × finds × hierarchy).
 */
function buildTypologyCountsFromFinds(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection,
  mode: 'sites' | 'mints'
): TypologyOptionCounts {
  const coinIssueById = new Map(coinIssues.map((c) => [c.id, c]))
  const hierarchyById = new Map(hierarchyRows.map((r) => [r.id, r]))
  const levelPrefix = selectionPath(sel)

  const levelMaps = new Map<number, Map<string, Set<string>>>()
  for (let depth = 1; depth <= 5; depth++) levelMaps.set(depth, new Map())
  const inscriptionMap = new Map<string, Set<string>>()

  const addLevel = (depth: number, value: string, groupKey: string | null) => {
    if (!groupKey) return
    const m = levelMaps.get(depth)!
    let set = m.get(value)
    if (!set) {
      set = new Set()
      m.set(value, set)
    }
    set.add(groupKey)
  }

  const addInscription = (inscriptionId: string, groupKey: string | null) => {
    if (!groupKey) return
    let set = inscriptionMap.get(inscriptionId)
    if (!set) {
      set = new Set()
      inscriptionMap.set(inscriptionId, set)
    }
    set.add(groupKey)
  }

  finds.forEach((find) => {
    if (!find.coin_issues_id) return
    const coin = coinIssueById.get(find.coin_issues_id)
    if (!coin) return
    const row = coin.coin_type_hierarchy_id ? hierarchyById.get(coin.coin_type_hierarchy_id) : undefined
    const path = row ? rowPath(row) : []
    const groupKey = mode === 'sites' ? find.site_code : coin.mint_zh

    for (let depth = 1; depth <= 5; depth++) {
      // Same prefix rules as buildTypologyOptionCounts' levelSel: depth-1
      // options ignore the current selection; deeper options require the
      // staged levels above to be set and to match this coin's path.
      let prefixOk = true
      for (let i = 0; i < depth - 1; i++) {
        const required = sel[LEVEL_KEYS[i]]
        if (!required || path[i] !== required) {
          prefixOk = false
          break
        }
      }
      if (!prefixOk) continue
      const value = path[depth - 1]
      if (!value) continue
      addLevel(depth, value, groupKey)
    }

    if (!coin.inscription_id) return
    if (levelPrefix.length === 0) {
      addInscription(coin.inscription_id, groupKey)
      return
    }
    if (pathStartsWith(path, levelPrefix)) {
      addInscription(coin.inscription_id, groupKey)
    }
  })

  return {
    level: (depth, value) => levelMaps.get(depth)?.get(value)?.size ?? 0,
    inscription: (inscriptionId) => inscriptionMap.get(inscriptionId)?.size ?? 0,
  }
}

/** Distinct find-site counts — used on Find Site, where "how many places"
 * is the natural read of the map. */
export function buildTypologySiteCounts(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): TypologyOptionCounts {
  return buildTypologyCountsFromFinds(finds, coinIssues, hierarchyRows, sel, 'sites')
}

/** Distinct mint-town counts (via each matching find's coin_issues.mint_zh)
 * — used on the database Mint Town tab, where "how many mint towns produced
 * this type" is more relevant than raw specimen quantity. */
export function buildTypologyMintCounts(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): TypologyOptionCounts {
  return buildTypologyCountsFromFinds(finds, coinIssues, hierarchyRows, sel, 'mints')
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
  for (const entry of entries) {
    const ids = getMatchingCoinIssueIds(coinIssues, hierarchyRows, entry.sel)
    if (!ids) continue
    ids.forEach((id) => result.add(id))
  }
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
    const qty = findQuantity(find, { includePresence: true })
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
 * key is the mint's zh name, inner key is entry.key. Used by the database
 * Mint Town tab's "by type" Compare view. */
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
    const mintZh = coinIssue?.mint_zh?.trim()
    if (!mintZh) return
    const qty = findQuantity(find, { includePresence: true })
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
