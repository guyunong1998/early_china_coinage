import { getMintByNameZh, MINT_TOWNS, resolveMintNameZh } from '@/lib/mint-towns'
import { coinMatchesTypologyFilter, hasTypologyFilter, type TypologyFilterSelection } from '@/lib/typology-filter'
import type { MintPoint } from '@/components/map/MapVisCanvas'
import type { CoinIssueDisplay, CoinTypeHierarchyRow, HeatmapFind } from '@/lib/types'

/** Which dataset a mint production heatmap is showing. */
export type HeatmapSource = 'database' | 'ans'
/** Which ANS spade catalogue a heatmap is showing, when source is 'ans'. */
export type AnsSpadeKind = 'pointed' | 'square'

export type PointedSpadeMintStat = {
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
  inMintTowns: boolean
}

function findQuantity(find: HeatmapFind): number {
  return find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? 0
}

/**
 * Aggregates database finds by mint town, optionally narrowed to a set of
 * matching coin_issues.id values (from typology-filter.ts's
 * getMatchingCoinIssueIds — same matching used by the find-site map). Every
 * known mint town is registered up front so the map keeps its full network
 * at zero count rather than dropping mints the active filter doesn't match;
 * only mints with known coordinates go in `mapped`.
 */
export function computeMintStatsFromFinds(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  matchedIds: Set<string> | null
): { mapped: PointedSpadeMintStat[]; unmapped: PointedSpadeMintStat[] } {
  const coinIssueById = new Map(coinIssues.map((c) => [c.id, c]))
  const groups = new Map<
    string,
    { findCount: number; coinCount: number; inscriptions: Set<string>; siteCodes: Set<string> }
  >()

  MINT_TOWNS.forEach((town) => {
    groups.set(town.name_zh, { findCount: 0, coinCount: 0, inscriptions: new Set(), siteCodes: new Set() })
  })

  finds.forEach((find) => {
    const issueId = find.coin_issues_id
    if (!issueId) return
    const coinIssue = coinIssueById.get(issueId)
    const mintRaw = coinIssue?.mint_zh?.trim()
    if (!mintRaw) return
    const mintZh = resolveMintNameZh(mintRaw)

    if (!groups.has(mintZh)) {
      groups.set(mintZh, { findCount: 0, coinCount: 0, inscriptions: new Set(), siteCodes: new Set() })
    }
    if (matchedIds && !matchedIds.has(issueId)) return

    const group = groups.get(mintZh)!
    group.findCount += 1
    group.coinCount += findQuantity(find)
    if (find.site_code) group.siteCodes.add(find.site_code)
    const insc = coinIssue!.inscription?.trim()
    if (insc) group.inscriptions.add(insc)
  })

  const stats: PointedSpadeMintStat[] = [...groups.entries()]
    .map(([mint_zh, g]) => {
      const town = getMintByNameZh(mint_zh)
      return {
        mint_zh,
        mint_en: town?.name_en ?? null,
        mint_code: town?.mint_code ?? null,
        lat: town?.lat ?? NaN,
        lng: town?.lng ?? NaN,
        findCount: g.findCount,
        coinCount: g.coinCount,
        siteCount: g.siteCodes.size,
        inscriptions: [...g.inscriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        state_zh: town?.state_zh ?? null,
        state_en: town?.state_en ?? null,
        modern_location_en: town?.modern_location_en ?? null,
        inTypology: false,
        inMintTowns: !!town,
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
export function toMintPoints(stats: PointedSpadeMintStat[]): MintPoint[] {
  return stats.map((m) => ({
    mint_zh: m.mint_zh,
    mint_en: m.mint_en,
    mint_code: m.mint_code,
    lat: m.lat,
    lng: m.lng,
    totalQty: m.coinCount,
    inscriptions: m.inscriptions,
    modern_location_en: m.modern_location_en,
  }))
}

/**
 * One row per specimen in the reconciled `public.ans_data` table (see
 * scripts/reconcile-ans-data.sql) — mint/state/hierarchy/inscription are
 * already resolved per specimen there (mint_id, hierarchy_id, inscription_id
 * FKs), unlike the older ANS spade catalogue (lib/ans-spade-data.ts, backed
 * by public/data/ans-*.json) which guesses a mint town from inscription text
 * via the typology file. Fetched by lib/ans-museum-data.ts.
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
  specimens: AnsSpecimen[]
): { mapped: PointedSpadeMintStat[]; unmapped: PointedSpadeMintStat[] } {
  const groups = new Map<string, { coinCount: number; inscriptions: Set<string> }>()

  MINT_TOWNS.forEach((town) => {
    groups.set(town.name_zh, { coinCount: 0, inscriptions: new Set() })
  })

  specimens.forEach((s) => {
    if (!s.mint_zh) return
    const mintZh = resolveMintNameZh(s.mint_zh)

    if (!groups.has(mintZh)) {
      groups.set(mintZh, { coinCount: 0, inscriptions: new Set() })
    }
    const group = groups.get(mintZh)!
    group.coinCount += 1
    const insc = s.inscription_raw?.trim()
    if (insc) group.inscriptions.add(insc)
  })

  const stats: PointedSpadeMintStat[] = [...groups.entries()]
    .map(([mint_zh, g]) => {
      const town = getMintByNameZh(mint_zh)
      return {
        mint_zh,
        mint_en: town?.name_en ?? null,
        mint_code: town?.mint_code ?? null,
        lat: town?.lat ?? NaN,
        lng: town?.lng ?? NaN,
        findCount: g.coinCount,
        coinCount: g.coinCount,
        siteCount: 0,
        inscriptions: [...g.inscriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        state_zh: town?.state_zh ?? null,
        state_en: town?.state_en ?? null,
        modern_location_en: town?.modern_location_en ?? null,
        inTypology: false,
        inMintTowns: !!town,
      }
    })
    .sort((a, b) => b.coinCount - a.coinCount || a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))

  const mapped = stats.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  const unmapped = stats.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng))

  return { mapped, unmapped }
}

/** Narrows ans_data specimens to the active typology filter, reusing the
 * exact same match rule as the database-backed Mint Town tab
 * (coinMatchesTypologyFilter) since ans_data.hierarchy_id/inscription_id
 * live in the same id space as coin_issues.coin_type_hierarchy_id/
 * inscription_id. Returns null when no filter is active (caller then knows
 * to treat every mint as "no-filter" rather than "zero matches"). */
export function getMatchingAnsSpecimens(
  specimens: AnsSpecimen[],
  hierarchyRows: CoinTypeHierarchyRow[],
  sel: TypologyFilterSelection
): AnsSpecimen[] | null {
  if (!hasTypologyFilter(sel)) return null
  return specimens.filter((s) =>
    coinMatchesTypologyFilter(
      { coin_type_hierarchy_id: s.hierarchy_id, inscription_id: s.inscription_id },
      hierarchyRows,
      sel
    )
  )
}
