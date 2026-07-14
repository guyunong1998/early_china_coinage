import { getMintByNameZh, MINT_TOWNS, resolveMintNameZh, type MintTown } from '@/lib/mint-towns'
import { supabase } from '@/lib/supabase'
import { TYPOLOGY } from '@/lib/typology-data'

const POINTED_FOOT_ZH = '尖足布'

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

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

/** All mint names listed under 尖足布 in Typology.xlsx. */
export function getTypologyPointedSpadeMints(): Set<string> {
  const mints = new Set<string>()

  for (const l1 of TYPOLOGY) {
    for (const l2 of l1.children) {
      for (const l3 of l2.children) {
        if (l3.type_key !== POINTED_FOOT_ZH) continue
        for (const entry of l3.entries) {
          if (entry.mint_zh?.trim()) mints.add(entry.mint_zh.trim())
        }
      }
    }
  }

  return mints
}

/** Mint towns documented as producing pointed-foot spades. */
export function getPointedSpadeMintTowns(): MintTown[] {
  return MINT_TOWNS.filter((m) => m.coin_types.includes('Pointed-foot spades'))
}

type FindRow = {
  quantity_total: number | null
  quantity_estimated: number | null
  quantity_min: number | null
  coin_types:
    | {
        mint_zh: string | null
        minor_type_zh: string | null
        inscription: string | null
      }
    | {
        mint_zh: string | null
        minor_type_zh: string | null
        inscription: string | null
      }[]
    | null
}

function coinTypeOf(find: FindRow) {
  const ct = find.coin_types
  if (!ct) return null
  return Array.isArray(ct) ? ct[0] ?? null : ct
}

function findQuantity(row: FindRow) {
  return row.quantity_total ?? row.quantity_estimated ?? row.quantity_min ?? 0
}

/**
 * Aggregates pointed-foot spade finds by mint, then joins typology + mint-town
 * metadata for map display. Only mints with known coordinates are returned
 * for the heatmap layer; the full stats list includes unmapped mints too.
 */
export async function getPointedSpadeMintStats(): Promise<{
  mapped: PointedSpadeMintStat[]
  unmapped: PointedSpadeMintStat[]
  ansSpadeRowCount: number
}> {
  const typologyMints = getTypologyPointedSpadeMints()
  const pointedMintTowns = getPointedSpadeMintTowns()

  const groups = new Map<
    string,
    { findCount: number; coinCount: number; inscriptions: Set<string> }
  >()

  const finds = await fetchAllPages<FindRow>((from, to) =>
    supabase
      .from('finds')
      .select(
        'quantity_total, quantity_estimated, quantity_min, coin_types(mint_zh, minor_type_zh, inscription)'
      )
      .order('find_code')
      .range(from, to)
  )

  finds.forEach((find) => {
    const coinType = coinTypeOf(find)
    if (coinType?.minor_type_zh?.trim() !== POINTED_FOOT_ZH) return
    const mintZh = resolveMintNameZh(coinType.mint_zh?.trim() ?? '')
    if (!mintZh) return

    if (!groups.has(mintZh)) {
      groups.set(mintZh, { findCount: 0, coinCount: 0, inscriptions: new Set() })
    }
    const group = groups.get(mintZh)!
    group.findCount += 1
    group.coinCount += findQuantity(find)
    const insc = coinType.inscription?.trim()
    if (insc) group.inscriptions.add(insc)
  })

  // Include typology / mint-town mints even when no finds are recorded yet.
  typologyMints.forEach((mintZh) => {
    if (!groups.has(mintZh)) {
      groups.set(mintZh, { findCount: 0, coinCount: 0, inscriptions: new Set() })
    }
  })
  pointedMintTowns.forEach((town) => {
    if (!groups.has(town.name_zh)) {
      groups.set(town.name_zh, { findCount: 0, coinCount: 0, inscriptions: new Set() })
    }
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
        inTypology: typologyMints.has(mint_zh),
        inMintTowns: pointedMintTowns.some((m) => m.name_zh === mint_zh),
      }
    })
    .sort((a, b) => b.coinCount - a.coinCount || a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))

  const mapped = stats.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  const unmapped = stats.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng))

  const { count: ansSpadeRowCount } = await supabase
    .from('ans_spade')
    .select('*', { count: 'exact', head: true })

  return { mapped, unmapped, ansSpadeRowCount: ansSpadeRowCount ?? 0 }
}
