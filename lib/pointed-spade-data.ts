import { getMintByNameZh, MINT_TOWNS, resolveMintNameZh } from '@/lib/mint-towns'
import type { MintPoint } from '@/components/map/MapVisCanvas'
import type { CoinType, HeatmapFind } from '@/lib/types'

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
 * matching coin_type_codes (from typology-filter.ts's getMatchingCoinTypeCodes
 * — same matching used by the find-site map). Every known mint town is
 * registered up front so the map keeps its full network at zero count rather
 * than dropping mints the active filter doesn't match; only mints with known
 * coordinates go in `mapped`.
 */
export function computeMintStatsFromFinds(
  finds: HeatmapFind[],
  coinTypes: CoinType[],
  matchedCodes: Set<string> | null
): { mapped: PointedSpadeMintStat[]; unmapped: PointedSpadeMintStat[] } {
  const coinTypeByCode = new Map(coinTypes.map((c) => [c.coin_type_code, c]))
  const groups = new Map<string, { findCount: number; coinCount: number; inscriptions: Set<string> }>()

  MINT_TOWNS.forEach((town) => {
    groups.set(town.name_zh, { findCount: 0, coinCount: 0, inscriptions: new Set() })
  })

  finds.forEach((find) => {
    const code = find.coin_type_code
    if (!code) return
    const coinType = coinTypeByCode.get(code)
    const mintRaw = coinType?.mint_zh?.trim()
    if (!mintRaw) return
    const mintZh = resolveMintNameZh(mintRaw)

    if (!groups.has(mintZh)) {
      groups.set(mintZh, { findCount: 0, coinCount: 0, inscriptions: new Set() })
    }
    if (matchedCodes && !matchedCodes.has(code)) return

    const group = groups.get(mintZh)!
    group.findCount += 1
    group.coinCount += findQuantity(find)
    const insc = coinType!.inscription?.trim()
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
