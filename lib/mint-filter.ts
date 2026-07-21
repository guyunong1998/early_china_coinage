import { getMintByNameZh } from '@/lib/mint-towns'
import type { CoinIssueDisplay, HeatmapFind } from '@/lib/types'

/** coin_type_code -> mint_id, the join every mint aggregation here needs
 * since `finds` only carries coin_type_code, not mint_id directly. */
function buildMintIdByCode(coinIssues: CoinIssueDisplay[]): Map<string, string> {
  return new Map(coinIssues.filter((c) => c.mint_id).map((c) => [c.coin_type_code, c.mint_id as string]))
}

function findQuantity(find: HeatmapFind): number {
  if (find.quantity_total != null) return find.quantity_total
  if (find.quantity_estimated != null) return find.quantity_estimated
  if (find.quantity_min != null) return find.quantity_min
  return find.presence ? 1 : 0
}

export type MintFilterOption = {
  mint_id: string
  mint_zh: string
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
  /** Number of coin_issues rows attributed to this mint. */
  coinTypeCount: number
  /** Number of distinct find sites with a coin attributed to this mint. */
  siteCount: number
  /** Whether the mint town itself has known map coordinates — when false,
   * selecting it still filters/colors sites normally, but no pin can be
   * dropped for the mint's own location (see PinPoint in MapVisCanvas). */
  hasCoordinates: boolean
}

/** Mint options grounded in live coin_issues.mint_id — no alias table needed,
 * since coin_issues already resolved each coin to a single mints row. */
export function buildMintFilterOptions(coinIssues: CoinIssueDisplay[], finds: HeatmapFind[]): MintFilterOption[] {
  const groups = new Map<
    string,
    {
      mint_zh: string
      mint_en: string | null
      state_zh: string | null
      state_en: string | null
      coinTypeCount: number
    }
  >()

  coinIssues.forEach((coin) => {
    if (!coin.mint_id) return
    const zh = (coin.mint_zh ?? '').trim()
    const existing = groups.get(coin.mint_id)
    if (existing) {
      existing.coinTypeCount += 1
      if (!existing.mint_en && coin.mint_en) existing.mint_en = coin.mint_en
      if (!existing.state_zh && coin.state_zh) existing.state_zh = coin.state_zh
      if (!existing.state_en && coin.state_en) existing.state_en = coin.state_en
      return
    }

    const town = zh ? getMintByNameZh(zh) : undefined
    groups.set(coin.mint_id, {
      mint_zh: zh || town?.name_zh || '',
      mint_en: town?.name_en ?? coin.mint_en ?? null,
      state_zh: town?.state_zh ?? coin.state_zh ?? null,
      state_en: town?.state_en ?? coin.state_en ?? null,
      coinTypeCount: 1,
    })
  })

  const mintIdByCode = buildMintIdByCode(coinIssues)
  const siteCodesByMint = new Map<string, Set<string>>()
  finds.forEach((find) => {
    if (!find.coin_type_code || !find.site_code) return
    const mintId = mintIdByCode.get(find.coin_type_code)
    if (!mintId) return
    if (!siteCodesByMint.has(mintId)) siteCodesByMint.set(mintId, new Set())
    siteCodesByMint.get(mintId)!.add(find.site_code)
  })

  return [...groups.entries()]
    .map(([mint_id, g]) => ({
      mint_id,
      mint_zh: g.mint_zh,
      mint_en: g.mint_en,
      state_zh: g.state_zh,
      state_en: g.state_en,
      coinTypeCount: g.coinTypeCount,
      siteCount: siteCodesByMint.get(mint_id)?.size ?? 0,
      hasCoordinates: getMintByNameZh(g.mint_zh)?.lat != null,
    }))
    .sort((a, b) => a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))
}

/** The option's display text, including its find-site count in parentheses
 * (e.g. "兹氏 (Zishi) — 赵 (12)") so a multiselect list stays informative
 * without opening each mint individually. */
export function formatMintOptionLabel(opt: MintFilterOption): string {
  const en = opt.mint_en ? ` (${opt.mint_en})` : ''
  const state = opt.state_zh ? ` — ${opt.state_zh}` : ''
  return `${opt.mint_zh}${en}${state} (${opt.siteCount})`
}

/** Returns matching coin_type_codes for any of the given mints (union), or
 * null when no mint is selected. */
export function getMatchingCoinTypeCodesByMints(
  coinIssues: CoinIssueDisplay[],
  mintIds: string[]
): Set<string> | null {
  if (mintIds.length === 0) return null
  const idSet = new Set(mintIds)
  return new Set(coinIssues.filter((c) => c.mint_id && idSet.has(c.mint_id)).map((c) => c.coin_type_code))
}

/**
 * Coin quantity at each site, broken out per mint — the Compare view's data
 * source: unlike the points/density views (which OR the selected mints into
 * one match-ratio per site), Compare needs each mint's own contribution at
 * a site kept separate, since a site with coins from two selected mints
 * renders as two distinct points, one per mint (see ComparePoint in
 * MapVisCanvas.tsx).
 */
export function computeSiteMintQuantities(
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[],
  mintIds: string[]
): Map<string, Map<string, number>> {
  const mintIdSet = new Set(mintIds)
  const mintIdByCode = buildMintIdByCode(coinIssues)
  const result = new Map<string, Map<string, number>>()

  finds.forEach((find) => {
    if (!find.site_code || !find.coin_type_code) return
    const mintId = mintIdByCode.get(find.coin_type_code)
    if (!mintId || !mintIdSet.has(mintId)) return
    const qty = findQuantity(find)
    if (qty <= 0) return

    if (!result.has(find.site_code)) result.set(find.site_code, new Map())
    const bySite = result.get(find.site_code)!
    bySite.set(mintId, (bySite.get(mintId) ?? 0) + qty)
  })

  return result
}
