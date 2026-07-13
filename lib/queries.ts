import { supabase } from '@/lib/supabase'
import type { Context, DatabaseStats, Find, MapSite, Site, Source } from '@/lib/types'

const MAP_SITE_FIELDS =
  'site_code, site_name_zh, site_name_en, province_zh, province_en, city_zh, city_en, county_zh, county_en, location_detail_zh, location_detail_en, lat, lng, precision_level, site_type_zh, site_type_en, find_record_count, total_quantity_for_map, major_types_zh, minor_types_zh, inscriptions, states_zh, mints_zh'

function splitSourceCodes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function getMapSites(): Promise<MapSite[]> {
  const { data, error } = await supabase
    .from('v_coin_map_sites')
    .select(MAP_SITE_FIELDS)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) throw error
  return data ?? []
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const [{ count: siteCount }, { count: findCount }, { data: quantities }] =
    await Promise.all([
      supabase.from('v_coin_map_sites').select('*', { count: 'exact', head: true }),
      supabase.from('finds').select('*', { count: 'exact', head: true }),
      supabase.from('v_coin_map_sites').select('total_quantity_for_map'),
    ])

  const totalCoins =
    quantities?.reduce((sum, row) => sum + (row.total_quantity_for_map ?? 0), 0) ?? 0

  return {
    siteCount: siteCount ?? 0,
    findCount: findCount ?? 0,
    totalCoins,
  }
}

export async function getSite(siteCode: string): Promise<Site | null> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('site_code', siteCode)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getSiteMapSummary(siteCode: string): Promise<MapSite | null> {
  const { data, error } = await supabase
    .from('v_coin_map_sites')
    .select(MAP_SITE_FIELDS)
    .eq('site_code', siteCode)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getSiteContexts(siteCode: string): Promise<Context[]> {
  const { data, error } = await supabase
    .from('contexts')
    .select('*')
    .eq('site_code', siteCode)
    .order('context_code')

  if (error) throw error
  return data ?? []
}

export async function getSiteFinds(contextCodes: string[]): Promise<Find[]> {
  if (contextCodes.length === 0) return []

  const { data, error } = await supabase
    .from('finds')
    .select('*, coin_types(*)')
    .in('context_code', contextCodes)
    .order('find_code')

  if (error) throw error
  return (data ?? []) as Find[]
}

export async function getSources(sourceCodes: string[]): Promise<Source[]> {
  const codes = [...new Set(sourceCodes.flatMap((raw) => splitSourceCodes(raw)).filter(Boolean))]
  if (codes.length === 0) return []

  const { data, error } = await supabase.from('sources').select('*').in('source_code', codes)

  if (error) throw error
  return data ?? []
}

export async function searchSites(query: string): Promise<MapSite[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const pattern = `%${trimmed}%`
  const { data, error } = await supabase
    .from('v_coin_map_sites')
    .select(MAP_SITE_FIELDS)
    .or(
      [
        `site_name_zh.ilike.${pattern}`,
        `site_name_en.ilike.${pattern}`,
        `province_zh.ilike.${pattern}`,
        `city_zh.ilike.${pattern}`,
        `county_zh.ilike.${pattern}`,
        `major_types_zh.ilike.${pattern}`,
        `minor_types_zh.ilike.${pattern}`,
        `inscriptions.ilike.${pattern}`,
        `states_zh.ilike.${pattern}`,
        `site_code.ilike.${pattern}`,
      ].join(',')
    )
    .order('site_name_zh')
    .limit(50)

  if (error) throw error
  return data ?? []
}

export type MintTypeOption = {
  key: string
  label: string
  siteCount: number
}

export type MintFindspotsData = {
  sites: MapSite[]
  typeOptions: MintTypeOption[]
  siteTypeKeys: Record<string, string[]>
}

function buildTypeKey(coin: {
  coin_type_code: string
  major_type_zh: string | null
  minor_type_zh: string | null
  inscription: string | null
}) {
  if (coin.minor_type_zh) return `minor:${coin.minor_type_zh}`
  if (coin.major_type_zh) return `major:${coin.major_type_zh}`
  if (coin.inscription) return `insc:${coin.inscription}`
  return `code:${coin.coin_type_code}`
}

function buildTypeLabel(coin: {
  major_type_zh: string | null
  minor_type_zh: string | null
  inscription: string | null
  coin_type_code: string
}) {
  if (coin.major_type_zh && coin.minor_type_zh) return `${coin.major_type_zh} · ${coin.minor_type_zh}`
  if (coin.minor_type_zh) return coin.minor_type_zh
  if (coin.major_type_zh) return coin.major_type_zh
  if (coin.inscription) return `Inscription: ${coin.inscription}`
  return coin.coin_type_code
}

/**
 * Returns mint-issued coin findspots based on finds+coin_types in current DB.
 * This powers the mint detail page distribution map and coin-type filters.
 */
export async function getMintFindspotsData(mintZh: string): Promise<MintFindspotsData> {
  if (!mintZh) return { sites: [], typeOptions: [], siteTypeKeys: {} }

  const { data: mintedCoinTypes, error: coinError } = await supabase
    .from('coin_types')
    .select('coin_type_code, major_type_zh, minor_type_zh, inscription, mint_zh')
    .eq('mint_zh', mintZh)

  if (coinError) throw coinError
  if (!mintedCoinTypes || mintedCoinTypes.length === 0) {
    return { sites: [], typeOptions: [], siteTypeKeys: {} }
  }

  const coinTypeCodes = mintedCoinTypes.map((row) => row.coin_type_code).filter(Boolean)
  if (coinTypeCodes.length === 0) return { sites: [], typeOptions: [], siteTypeKeys: {} }

  const { data: finds, error: findError } = await supabase
    .from('finds')
    .select('find_code, context_code, coin_type_code')
    .in('coin_type_code', coinTypeCodes)

  if (findError) throw findError
  if (!finds || finds.length === 0) return { sites: [], typeOptions: [], siteTypeKeys: {} }

  const contextCodes = [...new Set(finds.map((f) => f.context_code).filter(Boolean))]
  const { data: contexts, error: contextError } = await supabase
    .from('contexts')
    .select('context_code, site_code')
    .in('context_code', contextCodes)

  if (contextError) throw contextError

  const contextToSite = new Map<string, string>()
  ;(contexts ?? []).forEach((ctx) => contextToSite.set(ctx.context_code, ctx.site_code))

  const siteCodeSet = new Set<string>()
  const siteTypeSetMap = new Map<string, Set<string>>()
  const typeKeyToLabel = new Map<string, string>()

  const codeToTypeRow = new Map(
    mintedCoinTypes.map((row) => [row.coin_type_code, row] as const)
  )

  finds.forEach((find) => {
    const siteCode = contextToSite.get(find.context_code)
    if (!siteCode) return
    const typeRow = codeToTypeRow.get(find.coin_type_code ?? '')
    if (!typeRow) return

    const typeKey = buildTypeKey({
      coin_type_code: typeRow.coin_type_code,
      major_type_zh: typeRow.major_type_zh,
      minor_type_zh: typeRow.minor_type_zh,
      inscription: typeRow.inscription,
    })

    siteCodeSet.add(siteCode)
    if (!siteTypeSetMap.has(siteCode)) siteTypeSetMap.set(siteCode, new Set())
    siteTypeSetMap.get(siteCode)?.add(typeKey)
    typeKeyToLabel.set(typeKey, buildTypeLabel(typeRow))
  })

  const siteCodes = [...siteCodeSet]
  if (siteCodes.length === 0) return { sites: [], typeOptions: [], siteTypeKeys: {} }

  const { data: sites, error: siteError } = await supabase
    .from('v_coin_map_sites')
    .select(MAP_SITE_FIELDS)
    .in('site_code', siteCodes)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (siteError) throw siteError

  const siteTypeKeys: Record<string, string[]> = {}
  siteTypeSetMap.forEach((set, siteCode) => {
    siteTypeKeys[siteCode] = [...set]
  })

  const typeOptions: MintTypeOption[] = [...typeKeyToLabel.entries()]
    .map(([key, label]) => {
      const siteCount = Object.values(siteTypeKeys).filter((keys) => keys.includes(key)).length
      return { key, label, siteCount }
    })
    .sort((a, b) => b.siteCount - a.siteCount || a.label.localeCompare(b.label, 'zh-CN'))

  return { sites: sites ?? [], typeOptions, siteTypeKeys }
}
