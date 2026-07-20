import { getMintByNameZh } from '@/lib/mint-towns'
import type { CoinIssueDisplay } from '@/lib/types'

export type MintFilterOption = {
  mint_id: string
  mint_zh: string
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
  /** Number of coin_issues rows attributed to this mint. */
  coinTypeCount: number
}

/** Mint options grounded in live coin_issues.mint_id — no alias table needed,
 * since coin_issues already resolved each coin to a single mints row. */
export function buildMintFilterOptions(coinIssues: CoinIssueDisplay[]): MintFilterOption[] {
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

  return [...groups.entries()]
    .map(([mint_id, g]) => ({
      mint_id,
      mint_zh: g.mint_zh,
      mint_en: g.mint_en,
      state_zh: g.state_zh,
      state_en: g.state_en,
      coinTypeCount: g.coinTypeCount,
    }))
    .sort((a, b) => a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))
}

export function formatMintOptionLabel(opt: MintFilterOption): string {
  const en = opt.mint_en ? ` (${opt.mint_en})` : ''
  const state = opt.state_zh ? ` — ${opt.state_zh}` : ''
  return `${opt.mint_zh}${en}${state}`
}

/** Returns matching coin_type_codes for a mint, or null when no mint is selected. */
export function getMatchingCoinTypeCodesByMint(
  coinIssues: CoinIssueDisplay[],
  mintId: string
): Set<string> | null {
  if (!mintId) return null
  return new Set(coinIssues.filter((c) => c.mint_id === mintId).map((c) => c.coin_type_code))
}
