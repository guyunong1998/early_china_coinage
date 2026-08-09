import { findMintByNameZh } from '@/lib/mint-directory'
import {
  coinMatchesTypologyFilter,
  getMatchingHierarchyIds,
  type InscriptionSourceRow,
  type TypologyFilterSelection,
  type TypologyOptionCounts,
  type TypologySelectionEntry,
} from '@/lib/typology-filter'
import type { MintPoint } from '@/components/map/MapVisCanvas'
import type { CoinIssueDisplay, CoinTypeHierarchyRow, HeatmapFind, MintInfo } from '@/lib/types'

const LEVEL_KEYS: Array<keyof Pick<TypologyFilterSelection, 'level1' | 'level2' | 'level3' | 'level4' | 'level5'>> = [
  'level1',
  'level2',
  'level3',
  'level4',
  'level5',
]

/** Which dataset a mint production heatmap is showing — only 'database'
 * exists today, but the type (and the toggle row using it) is kept so a
 * future second source is just another entry, not a UI rebuild. */
export type HeatmapSource = 'database'

export type MintStat = {
  mint_zh: string
  mint_en: string | null
  mint_code: string | null
  lat: number
  lng: number
  findCount: number
  coinCount: number
  /** Number of distinct find sites with a coin attributed to this mint. */
  siteCount: number
  inscriptions: string[]
  state_zh: string | null
  state_en: string | null
  modern_location_en: string | null
  inTypology: boolean
  /** Whether this mint_zh matched a row in the live `mints` table. */
  inMintDirectory: boolean
}

function findQuantity(find: HeatmapFind): number {
  return find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? 0
}

/**
 * Aggregates database finds by mint town, optionally narrowed to a set of
 * matching coin_issues.id values (from typology-filter.ts's
 * getMatchingCoinIssueIds — same matching used by the find-site map). Every
 * mint in `mints` (the live `mints` table, from lib/queries.ts's getMints)
 * is registered up front so the map keeps its full network at zero count
 * rather than dropping mints the active filter doesn't match; only mints
 * with known coordinates go in `mapped`.
 *
 * `coinIssue.mint_zh` is already the canonical mints.name_zh (coin_issues.mint_id
 * is a real foreign key), so it's used as-is with no alias resolution — if a
 * mint_zh here ever fails to match a row in `mints`, that's a genuine data
 * inconsistency (e.g. a renamed/deleted mint) worth fixing at the source,
 * not papering over with a fuzzier lookup.
 */
export function computeMintStatsFromFinds(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  matchedIds: Set<string> | null,
  mints: MintInfo[],
  /** Filter-restyle paths only need coin/find counts — skip inscription
   * collection + zh sorting (noticeable on every typology keystroke). */
  options?: { includeInscriptions?: boolean }
): { mapped: MintStat[]; unmapped: MintStat[] } {
  const includeInscriptions = options?.includeInscriptions !== false
  const coinIssueById = new Map(coinIssues.map((c) => [c.id, c]))
  const groups = new Map<
    string,
    { findCount: number; coinCount: number; inscriptions: Set<string> | null; siteCodes: Set<string> }
  >()

  mints.forEach((mint) => {
    groups.set(mint.name_zh, {
      findCount: 0,
      coinCount: 0,
      inscriptions: includeInscriptions ? new Set() : null,
      siteCodes: new Set(),
    })
  })

  finds.forEach((find) => {
    const issueId = find.coin_issues_id
    if (!issueId) return
    const coinIssue = coinIssueById.get(issueId)
    const mintZh = coinIssue?.mint_zh?.trim()
    if (!mintZh) return

    if (!groups.has(mintZh)) {
      groups.set(mintZh, {
        findCount: 0,
        coinCount: 0,
        inscriptions: includeInscriptions ? new Set() : null,
        siteCodes: new Set(),
      })
    }
    if (matchedIds && !matchedIds.has(issueId)) return

    const group = groups.get(mintZh)!
    group.findCount += 1
    group.coinCount += findQuantity(find)
    if (find.site_code) group.siteCodes.add(find.site_code)
    if (includeInscriptions) {
      const insc = coinIssue!.inscription?.trim()
      if (insc) group.inscriptions!.add(insc)
    }
  })

  const stats: MintStat[] = [...groups.entries()]
    .map(([mint_zh, g]) => {
      const mint = findMintByNameZh(mints, mint_zh)
      return {
        mint_zh,
        mint_en: mint?.name_en ?? null,
        mint_code: mint?.mint_code ?? null,
        lat: mint?.lat ?? NaN,
        lng: mint?.lng ?? NaN,
        findCount: g.findCount,
        coinCount: g.coinCount,
        siteCount: g.siteCodes.size,
        inscriptions: includeInscriptions
          ? [...g.inscriptions!].sort((a, b) => a.localeCompare(b, 'zh-CN'))
          : [],
        state_zh: mint?.state_zh ?? null,
        state_en: mint?.state_en ?? null,
        modern_location_en: mint?.modern_location_en ?? null,
        inTypology: false,
        inMintDirectory: !!mint,
      }
    })
    .sort((a, b) => b.coinCount - a.coinCount || a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))

  const mapped = stats.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  const unmapped = stats.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng))

  return { mapped, unmapped }
}

/** Reshapes mapped mint stats into the plain `MintPoint[]` MapVisCanvas
 * plots — shared so every "mint town map" (the Mint Town visualization tab,
 * the /mints overview page, ...) renders from the exact same point list. */
export function toMintPoints(stats: MintStat[]): MintPoint[] {
  return stats.map((m) => ({
    mint_zh: m.mint_zh,
    mint_en: m.mint_en,
    mint_code: m.mint_code,
    lat: m.lat,
    lng: m.lng,
    totalQty: m.coinCount,
    findCount: m.findCount,
    inscriptions: m.inscriptions,
    modern_location_en: m.modern_location_en,
  }))
}

/**
 * One row per specimen in the reconciled `public.ans_data` table (see
 * scripts/reconcile-ans-data.sql) — mint/state/hierarchy/inscription are
 * already resolved per specimen there (mint_id, hierarchy_id, inscription_id
 * FKs), rather than guessed from inscription text. Fetched by
 * lib/ans-museum-data.ts.
 */
export type AnsSpecimen = {
  /** ans_data.id (a uuid) — the only field guaranteed unique per row.
   * catalog_number is NOT: the live table has specimens sharing one
   * accession number (e.g. obverse/reverse recorded as separate rows), so
   * selection state, map pin keys, and React list keys all key off `id`,
   * never catalog_number. */
  id: string
  catalog_number: string | null
  inscription_raw: string | null
  reverse_inscription: string | null
  hierarchy_id: string | null
  inscription_id: string | null
  mint_zh: string | null
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
}

/** ans_data.catalog_number is the specimen's ANS museum accession number
 * (e.g. "1937.146.16801"), which doubles as its slug in the ANS Online
 * Collection. */
export function ansCollectionUrl(catalogNumber: string): string {
  return `https://numismatics.org/collection/${encodeURIComponent(catalogNumber)}`
}

/**
 * Aggregates ans_data specimens by mint town — the ans_data equivalent of
 * computeMintStatsFromFinds above, except mint is read directly off each
 * specimen's own resolved mint_id rather than derived via a coin_type_code
 * lookup, since ans_data specimens aren't tied to coin_issues 1:1 (issue_id
 * is only set when the resolved combination matches exactly one existing
 * coin_issues row).
 */
export function computeAnsMintStats(
  specimens: AnsSpecimen[],
  mints: MintInfo[]
): { mapped: MintStat[]; unmapped: MintStat[] } {
  const groups = new Map<string, { coinCount: number; inscriptions: Set<string> }>()

  mints.forEach((mint) => {
    groups.set(mint.name_zh, { coinCount: 0, inscriptions: new Set() })
  })

  specimens.forEach((s) => {
    if (!s.mint_zh) return
    const mintZh = s.mint_zh

    if (!groups.has(mintZh)) {
      groups.set(mintZh, { coinCount: 0, inscriptions: new Set() })
    }
    const group = groups.get(mintZh)!
    group.coinCount += 1
    const insc = s.inscription_raw?.trim()
    if (insc) group.inscriptions.add(insc)
  })

  const stats: MintStat[] = [...groups.entries()]
    .map(([mint_zh, g]) => {
      const mint = findMintByNameZh(mints, mint_zh)
      return {
        mint_zh,
        mint_en: mint?.name_en ?? null,
        mint_code: mint?.mint_code ?? null,
        lat: mint?.lat ?? NaN,
        lng: mint?.lng ?? NaN,
        findCount: g.coinCount,
        coinCount: g.coinCount,
        siteCount: 0,
        inscriptions: [...g.inscriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        state_zh: mint?.state_zh ?? null,
        state_en: mint?.state_en ?? null,
        modern_location_en: mint?.modern_location_en ?? null,
        inTypology: false,
        inMintDirectory: !!mint,
      }
    })
    .sort((a, b) => b.coinCount - a.coinCount || a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))

  const mapped = stats.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  const unmapped = stats.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng))

  return { mapped, unmapped }
}

/** Narrows ans_data specimens to the active (multiselect, OR/ANY) typology
 * filter, reusing the exact same match rule as the database-backed Mint Town
 * tab (coinMatchesTypologyFilter) since ans_data.hierarchy_id/inscription_id
 * live in the same id space as coin_issues.coin_type_hierarchy_id/
 * inscription_id. For the Points/Density display in Museum Collections' Mint
 * Town view. Returns null when `entries` is empty (no filter active). */
export function getMatchingAnsSpecimensMulti(
  specimens: AnsSpecimen[],
  hierarchyRows: CoinTypeHierarchyRow[],
  entries: TypologySelectionEntry[]
): AnsSpecimen[] | null {
  if (entries.length === 0) return null
  // Precompute each entry's hierarchy id set once — coinMatchesTypologyFilter
  // would otherwise re-scan hierarchyRows for every specimen × entry.
  const entryMatchers = entries.map((entry) => ({
    sel: entry.sel,
    hierarchyIds: entry.sel.level1 ? getMatchingHierarchyIds(hierarchyRows, entry.sel) : null,
  }))
  return specimens.filter((s) =>
    entryMatchers.some(({ sel, hierarchyIds }) =>
      coinMatchesTypologyFilter(
        { coin_type_hierarchy_id: s.hierarchy_id, inscription_id: s.inscription_id },
        hierarchyRows,
        sel,
        hierarchyIds
      )
    )
  )
}

/** Per-option specimen counts for Museum Collections' type filter dropdowns
 * — the "(N)" hint beside each level1..level5 and inscription option, the
 * ans_data equivalent of buildTypologySpecimenCounts in typology-filter.ts.
 * Counts matching specimen rows directly (each row is already one physical
 * specimen) rather than summing a quantity field, since ans_data has none. */
export function buildAnsTypologySpecimenCounts(
  specimens: AnsSpecimen[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): TypologyOptionCounts {
  // One pass over specimens (same idea as buildTypologySpecimenCounts) —
  // per-option filter scans were O(options × specimens × hierarchy).
  const hierarchyById = new Map(hierarchyRows.map((r) => [r.id, r]))
  const levelPrefix: string[] = []
  for (const key of LEVEL_KEYS) {
    const v = sel[key]
    if (!v) break
    levelPrefix.push(v)
  }

  const levelMaps = new Map<number, Map<string, number>>()
  for (let depth = 1; depth <= 5; depth++) levelMaps.set(depth, new Map())
  const inscriptionMap = new Map<string, number>()

  for (const s of specimens) {
    const row = s.hierarchy_id ? hierarchyById.get(s.hierarchy_id) : undefined
    const path: string[] = []
    if (row) {
      for (const v of [row.level1_zh, row.level2_zh, row.level3_zh, row.level4_zh, row.level5_zh]) {
        if (!v) break
        path.push(v)
      }
    }

    for (let depth = 1; depth <= 5; depth++) {
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
      const m = levelMaps.get(depth)!
      m.set(value, (m.get(value) ?? 0) + 1)
    }

    if (!s.inscription_id) continue
    if (levelPrefix.length === 0) {
      inscriptionMap.set(s.inscription_id, (inscriptionMap.get(s.inscription_id) ?? 0) + 1)
      continue
    }
    if (levelPrefix.every((v, i) => path[i] === v)) {
      inscriptionMap.set(s.inscription_id, (inscriptionMap.get(s.inscription_id) ?? 0) + 1)
    }
  }

  return {
    level: (depth, value) => levelMaps.get(depth)?.get(value) ?? 0,
    inscription: (inscriptionId) => inscriptionMap.get(inscriptionId) ?? 0,
  }
}

/**
 * Museum Collections' inscription-filter source: one entry per specimen that
 * actually has an inscription, shaped to slot straight into
 * lib/typology-filter.ts's getInscriptionOptions/describeTypologySelection
 * (they only ever read this narrow shape — see InscriptionSourceRow) in
 * place of the real coin_issues catalog. This is what scopes the Museum
 * Collections filter's inscription dropdown (and its count) to inscriptions
 * that actually exist among ans_data specimens, instead of every inscription
 * catalogued sitewide.
 *
 * ans_data doesn't carry its own zh/en inscription label — only
 * inscription_raw (the specimen's own transcribed text) plus inscription_id
 * (a FK in the same id space as coin_issues.inscription_id, per
 * docs/ARCHITECTURE.md). So the label prefers the matching coin_issues row's
 * bilingual `inscription`/`inscription_en` where one exists, and falls back
 * to inscription_raw for specimens whose inscription isn't (yet) catalogued
 * as a coin_issues row at all.
 */
export function buildAnsInscriptionSource(
  specimens: AnsSpecimen[],
  coinIssues: CoinIssueDisplay[]
): InscriptionSourceRow[] {
  const issueByInscriptionId = new Map<string, CoinIssueDisplay>()
  coinIssues.forEach((c) => {
    if (c.inscription_id && !issueByInscriptionId.has(c.inscription_id)) issueByInscriptionId.set(c.inscription_id, c)
  })

  return specimens.flatMap((s): InscriptionSourceRow[] => {
    if (!s.inscription_id) return []
    const issue = issueByInscriptionId.get(s.inscription_id)
    const zh = issue?.inscription ?? s.inscription_raw
    if (!zh) return []
    return [
      {
        inscription_id: s.inscription_id,
        inscription: zh,
        inscription_en: issue?.inscription_en ?? s.inscription_raw,
        mint_zh: s.mint_zh,
        coin_type_hierarchy_id: s.hierarchy_id,
      },
    ]
  })
}

/** Per-mint, per-selection-entry specimen counts for Compare mode — outer
 * key is the resolved mint zh name, inner key is entry.key. The ans_data
 * equivalent of computeMintTypeQuantities in typology-filter.ts, used by
 * Museum Collections' Mint Town Compare view. */
export function computeAnsMintTypeQuantities(
  specimens: AnsSpecimen[],
  hierarchyRows: CoinTypeHierarchyRow[],
  entries: TypologySelectionEntry[]
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  specimens.forEach((s) => {
    if (!s.mint_zh) return
    const mintZh = s.mint_zh
    entries.forEach((entry) => {
      const matches = coinMatchesTypologyFilter(
        { coin_type_hierarchy_id: s.hierarchy_id, inscription_id: s.inscription_id },
        hierarchyRows,
        entry.sel
      )
      if (!matches) return
      if (!result.has(mintZh)) result.set(mintZh, new Map())
      const byMint = result.get(mintZh)!
      byMint.set(entry.key, (byMint.get(entry.key) ?? 0) + 1)
    })
  })
  return result
}
