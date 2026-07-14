import { getMintByNameZh, getMintNameVariants, resolveMintNameZh } from '@/lib/mint-towns'
import type { CoinType } from '@/lib/types'
import { ALL_MINTS } from '@/lib/typology-data'

export type MintFilterOption = {
  mint_zh: string
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
  /** Number of coin_types rows attributed to this mint (incl. aliases). */
  coinTypeCount: number
}

/** Mint options grounded in DB coin_types, consolidated by alias. */
export function buildMintFilterOptions(coinTypes: CoinType[]): MintFilterOption[] {
  const groups = new Map<
    string,
    {
      mint_en: string | null
      state_zh: string | null
      state_en: string | null
      coinTypeCount: number
    }
  >()

  const metaByCanonical = new Map<string, (typeof ALL_MINTS)[number]>()
  ALL_MINTS.forEach((m) => {
    metaByCanonical.set(resolveMintNameZh(m.mint_zh), m)
  })

  coinTypes.forEach((coin) => {
    const zh = (coin.mint_zh ?? '').trim()
    if (!zh) return
    const key = resolveMintNameZh(zh)
    const existing = groups.get(key)
    if (existing) {
      existing.coinTypeCount += 1
      if (!existing.mint_en && coin.mint_en) existing.mint_en = coin.mint_en
      if (!existing.state_zh && coin.state_zh) existing.state_zh = coin.state_zh
      if (!existing.state_en && coin.state_en) existing.state_en = coin.state_en
      return
    }

    const town = getMintByNameZh(zh)
    const meta = metaByCanonical.get(key)
    groups.set(key, {
      mint_en: town?.name_en ?? meta?.mint_en ?? coin.mint_en ?? null,
      state_zh: town?.state_zh ?? meta?.state_zh ?? coin.state_zh ?? null,
      state_en: town?.state_en ?? meta?.state_en ?? coin.state_en ?? null,
      coinTypeCount: 1,
    })
  })

  return [...groups.entries()]
    .map(([mint_zh, g]) => ({
      mint_zh,
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
  coinTypes: CoinType[],
  mintZh: string
): Set<string> | null {
  const trimmed = mintZh.trim()
  if (!trimmed) return null
  const variants = new Set(getMintNameVariants(trimmed))
  return new Set(
    coinTypes
      .filter((c) => c.mint_zh && variants.has(c.mint_zh.trim()))
      .map((c) => c.coin_type_code)
  )
}
