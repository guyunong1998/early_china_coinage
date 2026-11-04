import { findMintByNameZh } from '@/lib/mint-directory'
import { findQuantity } from '@/lib/quantity'
import type {
  InscriptionSourceRow,
  TypologyFilterSelection,
  TypologyOptionCounts,
  TypologySelectionEntry,
} from '@/lib/typology-filter'
import type { MintPoint } from '@/components/map/MapVisCanvas'
import type { MintStatsRow } from '@/lib/queries'
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

/** The fields every MintStat row needs beyond mint_zh — findQuantity/
 * inscription/site-count semantics differ slightly between the database-find
 * and ans_data aggregations below, so each builds its own group shape and
 * normalizes into this one before handing off to statsFromGroups. */
type MintStatGroup = {
  findCount: number
  coinCount: number
  siteCount: number
  inscriptions: string[]
}

/** Shared mint_zh -> MintStat resolution (mints-table lookup, mapped/unmapped
 * split by coordinate availability, sort by coin count) for both
 * computeMintStatsFromFinds and computeAnsMintStats below — they differ only
 * in how they aggregate their source rows into a MintStatGroup per mint. */
function statsFromGroups(
  groups: Map<string, MintStatGroup>,
  mints: MintInfo[]
): { mapped: MintStat[]; unmapped: MintStat[] } {
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
        siteCount: g.siteCount,
        inscriptions: g.inscriptions,
        state_zh: mint?.state_zh ?? null,
        state_en: mint?.state_en ?? null,
        modern_location_en: mint?.modern_location_en ?? null,
        inTypology: false,
        inMintDirectory: !!mint,
      }
    })
    .sort((a, b) => b.coinCount - a.coinCount || a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))

  return {
    mapped: stats.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
    unmapped: stats.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng)),
  }
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

  const normalized = new Map<string, MintStatGroup>(
    [...groups.entries()].map(([mint_zh, g]) => [
      mint_zh,
      {
        findCount: g.findCount,
        coinCount: g.coinCount,
        siteCount: g.siteCodes.size,
        inscriptions: includeInscriptions ? [...g.inscriptions!].sort((a, b) => a.localeCompare(b, 'zh-CN')) : [],
      },
    ])
  )
  return statsFromGroups(normalized, mints)
}

/** Unfiltered equivalent of computeMintStatsFromFinds, built from
 * v_mint_stats rows (already aggregated in Postgres) instead of the full
 * finds + coin_issues tables — for overview consumers like /mints that never
 * apply a typology filter. */
export function computeMintStatsFromView(
  rows: MintStatsRow[],
  mints: MintInfo[]
): { mapped: MintStat[]; unmapped: MintStat[] } {
  const nameZhById = new Map(mints.map((m) => [m.id, m.name_zh]))
  const groups = new Map<string, MintStatGroup>()
  rows.forEach((r) => {
    const mintZh = nameZhById.get(r.mint_id)
    if (!mintZh) return
    groups.set(mintZh, {
      findCount: r.find_count,
      coinCount: r.coin_count,
      siteCount: r.site_count,
      inscriptions: [...r.inscriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    })
  })
  return statsFromGroups(groups, mints)
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
 * scripts/reconcile-ans-data.sql), as flattened by `v_ans_flat`
 * (scripts/add-ans-flat-view.sql) — mint/state/hierarchy/inscription are
 * already resolved per specimen there via their FKs (mint_id, hierarchy_id,
 * inscription_id), rather than guessed from inscription text. Fetched by
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
  level1_zh: string | null
  level1_en: string | null
  level2_zh: string | null
  level2_en: string | null
  level3_zh: string | null
  level3_en: string | null
  level4_zh: string | null
  level4_en: string | null
  level5_zh: string | null
  level5_en: string | null
  /** `public.inscriptions.inscription_zh` is NOT NULL + UNIQUE, so it's a
   * safe match key on its own — no inscription_id needed to disambiguate. */
  inscription_zh: string | null
  inscription_en: string | null
  mint_zh: string | null
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
}

/** An ans_data specimen's own level1..level5 path, trimmed at the first
 * unset level — the ans_data equivalent of typology-filter.ts's (unexported)
 * rowPath, reading directly off the specimen's already-flattened hierarchy
 * levels instead of looking a hierarchy row up by id. */
function ansSpecimenPath(s: AnsSpecimen): string[] {
  const path: string[] = []
  for (const v of [s.level1_zh, s.level2_zh, s.level3_zh, s.level4_zh, s.level5_zh]) {
    if (!v) break
    path.push(v)
  }
  return path
}

/**
 * Synthetic coin_type_hierarchy rows built from the distinct level1..level5
 * paths actually present among ans_data specimens — lets Museum Collections'
 * type-filter picker (TypologyFilterBar, useTypologyMultiSelect) and
 * buildAnsInscriptionSource's id reconstruction run on the same generic,
 * id-based machinery as the real coin_issues catalog, without a separate
 * getCoinTypeHierarchy() fetch. This also scopes the dropdown to categories
 * this museum's own specimens actually have, rather than every sitewide
 * category (some of which have zero ANS specimens).
 *
 * `id`/`type_code` are the path itself, never a real coin_type_hierarchy.id
 * — this synthetic catalog is self-contained and never compared against the
 * real one.
 */
export function buildAnsHierarchyRows(specimens: AnsSpecimen[]): CoinTypeHierarchyRow[] {
  const rows = new Map<string, CoinTypeHierarchyRow>()
  specimens.forEach((s) => {
    const path = ansSpecimenPath(s)
    if (path.length === 0) return
    const key = path.join('\u0000')
    if (rows.has(key)) return
    rows.set(key, {
      id: key,
      level1_zh: s.level1_zh,
      level1_en: s.level1_en,
      level2_zh: s.level2_zh,
      level2_en: s.level2_en,
      level3_zh: s.level3_zh,
      level3_en: s.level3_en,
      level4_zh: s.level4_zh,
      level4_en: s.level4_en,
      level5_zh: s.level5_zh,
      level5_en: s.level5_en,
      img_acc_num: null,
      description_zh: null,
      description_en: null,
      type_code: key,
    })
  })
  return [...rows.values()]
}

/** ans_data equivalent of typology-filter.ts's coinMatchesTypologyFilter —
 * matches the specimen's own level path directly instead of resolving
 * coin_type_hierarchy_id through hierarchyRows, since v_ans_flat already
 * inlines the path. Inscription matches by inscription_zh text — safe since
 * it's NOT NULL + UNIQUE — rather than an id, since `sel.inscriptionId` here
 * is whatever key buildAnsInscriptionSource assigned (inscription_zh, not a
 * real inscriptions.id). */
function ansMatchesTypologyFilter(s: AnsSpecimen, sel: TypologyFilterSelection): boolean {
  if (!sel.level1) {
    if (!sel.inscriptionId) return false
    return s.inscription_zh === sel.inscriptionId
  }
  const prefix: string[] = []
  for (const v of [sel.level1, sel.level2, sel.level3, sel.level4, sel.level5]) {
    if (!v) break
    prefix.push(v)
  }
  const path = ansSpecimenPath(s)
  if (prefix.length > path.length || !prefix.every((v, i) => path[i] === v)) return false
  if (sel.inscriptionId) return s.inscription_zh === sel.inscriptionId
  return true
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
    const insc = s.inscription_zh?.trim()
    if (insc) group.inscriptions.add(insc)
  })

  const normalized = new Map<string, MintStatGroup>(
    [...groups.entries()].map(([mint_zh, g]) => [
      mint_zh,
      {
        findCount: g.coinCount,
        coinCount: g.coinCount,
        siteCount: 0,
        inscriptions: [...g.inscriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      },
    ])
  )
  return statsFromGroups(normalized, mints)
}

/** Narrows ans_data specimens to the active (multiselect, OR/ANY) typology
 * filter, reusing the same match rule as the database-backed Mint Town tab
 * (coinMatchesTypologyFilter) via ansMatchesTypologyFilter, which matches
 * against the specimen's own inlined level1..level5 path instead of a
 * coin_type_hierarchy_id lookup. For the Points/Density display in Museum
 * Collections' Mint Town view. Returns null when `entries` is empty (no
 * filter active). */
export function getMatchingAnsSpecimensMulti(
  specimens: AnsSpecimen[],
  entries: TypologySelectionEntry[]
): AnsSpecimen[] | null {
  if (entries.length === 0) return null
  return specimens.filter((s) => entries.some((entry) => ansMatchesTypologyFilter(s, entry.sel)))
}

/** Per-option distinct-mint-town counts for Museum Collections' type filter
 * dropdowns — the "(N)" hint beside each level1..level5 and inscription
 * option, the ans_data equivalent of buildTypologyMintCounts in
 * typology-filter.ts. Counts distinct specimen.mint_zh values rather than
 * specimen rows, since Museum Collections' Mint Town tab cares about "how
 * many mint towns produced this type", not raw specimen count. Specimens
 * with no resolved mint_zh can't contribute to that count and are skipped. */
export function buildAnsTypologyMintCounts(
  specimens: AnsSpecimen[],
  sel: TypologyFilterSelection
): TypologyOptionCounts {
  // One pass over specimens (same idea as buildTypologyMintCounts) —
  // per-option filter scans were O(options × specimens × hierarchy).
  const levelPrefix: string[] = []
  for (const key of LEVEL_KEYS) {
    const v = sel[key]
    if (!v) break
    levelPrefix.push(v)
  }

  const levelMaps = new Map<number, Map<string, Set<string>>>()
  for (let depth = 1; depth <= 5; depth++) levelMaps.set(depth, new Map())
  const inscriptionMap = new Map<string, Set<string>>()

  for (const s of specimens) {
    if (!s.mint_zh) continue
    const path = ansSpecimenPath(s)

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
      let set = m.get(value)
      if (!set) {
        set = new Set()
        m.set(value, set)
      }
      set.add(s.mint_zh)
    }

    if (!s.inscription_zh) continue
    const matchesPrefix = levelPrefix.length === 0 || levelPrefix.every((v, i) => path[i] === v)
    if (matchesPrefix) {
      let set = inscriptionMap.get(s.inscription_zh)
      if (!set) {
        set = new Set()
        inscriptionMap.set(s.inscription_zh, set)
      }
      set.add(s.mint_zh)
    }
  }

  return {
    level: (depth, value) => levelMaps.get(depth)?.get(value)?.size ?? 0,
    inscription: (inscriptionId) => inscriptionMap.get(inscriptionId)?.size ?? 0,
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
 * v_ans_flat resolves inscription_id to its own bilingual inscription_zh/en
 * directly, so no coin_issues cross-reference is needed for the label
 * itself. InscriptionSourceRow's `inscription_id` field is filled with
 * inscription_zh instead of a real inscriptions.id — safe as a match/dedupe
 * key since inscription_zh is NOT NULL + UNIQUE, and this synthesized source
 * never mixes with the real coin_issues catalog's ids. coin_type_hierarchy_id
 * is still required by the shared coinMatchesTypologyFilter (used inside
 * getInscriptionOptions to scope inscriptions to the currently-selected
 * type), so it's reconstructed here by matching the specimen's own
 * level1..level5 path against hierarchyRows — the same row v_ans_flat's join
 * resolved it from.
 */
export function buildAnsInscriptionSource(
  specimens: AnsSpecimen[],
  hierarchyRows: CoinTypeHierarchyRow[]
): InscriptionSourceRow[] {
  const hierarchyIdByPath = new Map<string, string>()
  hierarchyRows.forEach((row) => {
    const path: string[] = []
    for (const v of [row.level1_zh, row.level2_zh, row.level3_zh, row.level4_zh, row.level5_zh]) {
      if (!v) break
      path.push(v)
    }
    if (path.length > 0) hierarchyIdByPath.set(path.join('\u0000'), row.id)
  })

  return specimens.flatMap((s): InscriptionSourceRow[] => {
    if (!s.inscription_zh) return []
    const path = ansSpecimenPath(s)
    return [
      {
        inscription_id: s.inscription_zh,
        inscription: s.inscription_zh,
        inscription_en: s.inscription_en ?? s.inscription_zh,
        mint_zh: s.mint_zh,
        coin_type_hierarchy_id: path.length > 0 ? (hierarchyIdByPath.get(path.join('\u0000')) ?? null) : null,
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
  entries: TypologySelectionEntry[]
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  specimens.forEach((s) => {
    if (!s.mint_zh) return
    const mintZh = s.mint_zh
    entries.forEach((entry) => {
      if (!ansMatchesTypologyFilter(s, entry.sel)) return
      if (!result.has(mintZh)) result.set(mintZh, new Map())
      const byMint = result.get(mintZh)!
      byMint.set(entry.key, (byMint.get(entry.key) ?? 0) + 1)
    })
  })
  return result
}
