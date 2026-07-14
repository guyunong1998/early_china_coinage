import { splitCsv } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import type { Context, CoinType, DatabaseStats, Find, HeatmapFind, MapSite, Site, Source } from '@/lib/types'

const MAP_SITE_FIELDS =
  'site_code, site_name_zh, site_name_en, province_zh, province_en, city_zh, city_en, county_zh, county_en, location_detail_zh, location_detail_en, lat, lng, precision_level, site_type_zh, site_type_en, find_record_count, total_quantity_for_map, major_types_zh, minor_types_zh, inscriptions, states_zh, mints_zh'

export type SearchSite = MapSite & { period_zh: string | null; period_en: string | null }

function splitSourceCodes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Supabase's PostgREST API caps responses at 1000 rows by default. Several
 * tables here (sites, finds, contexts) exceed that, so a single
 * un-paginated request silently drops everything past the cutoff — e.g.
 * many Shanxi/Hebei/Shaanxi sites vanishing from the map. This pages
 * through with `.range()` until a short (or empty) page signals the end.
 */
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

async function attachPeriods(sites: MapSite[]): Promise<SearchSite[]> {
  const { data, error } = await supabase.from('sites').select('site_code, period_zh, period_en')
  if (error) throw error

  const periodBySiteCode = new Map((data ?? []).map((row) => [row.site_code, row]))
  return sites.map((site) => {
    const period = periodBySiteCode.get(site.site_code)
    return { ...site, period_zh: period?.period_zh ?? null, period_en: period?.period_en ?? null }
  })
}

function textIncludes(value: string | null | undefined, query: string): boolean {
  return !!value && value.toLowerCase().includes(query)
}

export async function getMapSites(): Promise<MapSite[]> {
  return fetchAllPages<MapSite>((from, to) =>
    supabase
      .from('v_coin_map_sites')
      .select(MAP_SITE_FIELDS)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('site_code')
      .range(from, to)
  )
}

type SitePrecisionRow = {
  site_code: string
  site_name_zh: string | null
  site_name_en: string | null
  province_zh: string | null
  province_en: string | null
  city_zh: string | null
  city_en: string | null
  county_zh: string | null
  county_en: string | null
  location_detail_zh: string | null
  location_detail_en: string | null
  lat: number | null
  lng: number | null
  precision_level: number | null
  site_type_zh: string | null
  site_type_en: string | null
}

function siteRowToMapSite(row: SitePrecisionRow): MapSite {
  return {
    site_code: row.site_code,
    site_name_zh: row.site_name_zh,
    site_name_en: row.site_name_en,
    province_zh: row.province_zh,
    province_en: row.province_en,
    city_zh: row.city_zh,
    city_en: row.city_en,
    county_zh: row.county_zh,
    county_en: row.county_en,
    location_detail_zh: row.location_detail_zh,
    location_detail_en: row.location_detail_en,
    lat: row.lat,
    lng: row.lng,
    precision_level: row.precision_level,
    site_type_zh: row.site_type_zh,
    site_type_en: row.site_type_en,
    find_record_count: null,
    total_quantity_for_map: null,
    major_types_zh: null,
    minor_types_zh: null,
    inscriptions: null,
    states_zh: null,
    mints_zh: null,
  }
}

/** Sites tagged 不明单位 / county=不明 that may be missing from v_coin_map_sites. */
async function getPrecisionSupplementSites(): Promise<MapSite[]> {
  const [nameTagged, countyTagged] = await Promise.all([
    fetchAllPages<SitePrecisionRow>((from, to) =>
      supabase
        .from('sites')
        .select(
          'site_code, site_name_zh, site_name_en, province_zh, province_en, city_zh, city_en, county_zh, county_en, location_detail_zh, location_detail_en, lat, lng, precision_level, site_type_zh, site_type_en'
        )
        .ilike('site_name_zh', '%不明单位%')
        .order('site_code')
        .range(from, to)
    ),
    fetchAllPages<SitePrecisionRow>((from, to) =>
      supabase
        .from('sites')
        .select(
          'site_code, site_name_zh, site_name_en, province_zh, province_en, city_zh, city_en, county_zh, county_en, location_detail_zh, location_detail_en, lat, lng, precision_level, site_type_zh, site_type_en'
        )
        .eq('county_zh', '不明')
        .order('site_code')
        .range(from, to)
    ),
  ])

  const byCode = new Map<string, MapSite>()
  ;[...nameTagged, ...countyTagged].forEach((row) => {
    byCode.set(row.site_code, siteRowToMapSite(row))
  })
  return [...byCode.values()]
}

function mergeMapSites(base: MapSite[], extras: MapSite[]): MapSite[] {
  const byCode = new Map<string, MapSite>()
  base.forEach((site) => byCode.set(site.site_code, site))
  extras.forEach((site) => {
    if (!byCode.has(site.site_code)) byCode.set(site.site_code, site)
  })
  return [...byCode.values()].sort((a, b) => a.site_code.localeCompare(b.site_code))
}

/**
 * Find Spots map sites: georeferenced view rows, plus any precision-tagged
 * rows from `sites` that the map view omits (e.g. 「不明单位」 without coords).
 * County-level count should match the sites table (39 × 不明单位).
 */
export async function getFindSpotsMapSites(): Promise<MapSite[]> {
  const [mapped, supplements] = await Promise.all([getMapSites(), getPrecisionSupplementSites()])
  return mergeMapSites(mapped, supplements)
}

/** Sums `total_quantity_for_map` across every row, paginating past PostgREST's 1000-row cap. */
async function sumTotalQuantityForMap(): Promise<number> {
  const rows = await fetchAllPages<{ total_quantity_for_map: number | null }>((from, to) =>
    supabase
      .from('v_coin_map_sites')
      .select('site_code, total_quantity_for_map')
      .order('site_code')
      .range(from, to)
  )
  return rows.reduce((sum, row) => sum + (row.total_quantity_for_map ?? 0), 0)
}

export async function getAllSites(): Promise<SearchSite[]> {
  const [sites, supplements] = await Promise.all([
    fetchAllPages<MapSite>((from, to) =>
      supabase.from('v_coin_map_sites').select(MAP_SITE_FIELDS).order('site_name_zh').range(from, to)
    ),
    getPrecisionSupplementSites(),
  ])
  return attachPeriods(mergeMapSites(sites, supplements))
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const [{ count: siteCount }, { count: findCount }, totalCoins] = await Promise.all([
    supabase.from('v_coin_map_sites').select('*', { count: 'exact', head: true }),
    supabase.from('finds').select('*', { count: 'exact', head: true }),
    sumTotalQuantityForMap(),
  ])

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

/**
 * Runs entirely in memory (dataset is ~561 sites / ~487 coin types, trivial to
 * hold at once) rather than as a Postgres ilike query, for two reasons:
 * 1. The aggregated view only stores Chinese text for coin type/mint/state/
 *    inscription, so an English search term (e.g. "Handan") has to be translated
 *    to its Chinese equivalent via the coin_types catalog before it can match.
 * 2. Site period isn't on the view at all — it's joined in from `sites` — so it
 *    can't be expressed as a single SQL OR clause against v_coin_map_sites.
 */
export async function searchSites(query: string): Promise<SearchSite[]> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const [sites, coinTypes] = await Promise.all([getAllSites(), getCoinTypes()])

  const zhTerms = new Set<string>()
  coinTypes.forEach((c) => {
    if (textIncludes(c.major_type_en, trimmed) && c.major_type_zh) zhTerms.add(c.major_type_zh)
    if (textIncludes(c.minor_type_en, trimmed) && c.minor_type_zh) zhTerms.add(c.minor_type_zh)
    if (textIncludes(c.inscription_en, trimmed) && c.inscription) zhTerms.add(c.inscription)
    if (textIncludes(c.mint_en, trimmed) && c.mint_zh) zhTerms.add(c.mint_zh)
    if (textIncludes(c.state_en, trimmed) && c.state_zh) zhTerms.add(c.state_zh)
  })

  return sites.filter((site) => {
    const directMatch =
      textIncludes(site.site_name_zh, trimmed) ||
      textIncludes(site.site_name_en, trimmed) ||
      textIncludes(site.province_zh, trimmed) ||
      textIncludes(site.province_en, trimmed) ||
      textIncludes(site.city_zh, trimmed) ||
      textIncludes(site.city_en, trimmed) ||
      textIncludes(site.county_zh, trimmed) ||
      textIncludes(site.county_en, trimmed) ||
      textIncludes(site.site_type_zh, trimmed) ||
      textIncludes(site.site_type_en, trimmed) ||
      textIncludes(site.period_zh, trimmed) ||
      textIncludes(site.period_en, trimmed) ||
      textIncludes(site.major_types_zh, trimmed) ||
      textIncludes(site.minor_types_zh, trimmed) ||
      textIncludes(site.inscriptions, trimmed) ||
      textIncludes(site.states_zh, trimmed) ||
      textIncludes(site.mints_zh, trimmed) ||
      textIncludes(site.site_code, trimmed)

    if (directMatch) return true
    if (zhTerms.size === 0) return false

    return [...zhTerms].some(
      (term) =>
        splitCsv(site.major_types_zh).includes(term) ||
        splitCsv(site.minor_types_zh).includes(term) ||
        splitCsv(site.inscriptions).includes(term) ||
        splitCsv(site.states_zh).includes(term) ||
        splitCsv(site.mints_zh).includes(term)
    )
  })
}

export async function getCoinTypes(): Promise<CoinType[]> {
  return fetchAllPages<CoinType>((from, to) =>
    supabase
      .from('coin_types')
      .select('*')
      .order('major_type_zh')
      .order('minor_type_zh')
      .order('inscription')
      .order('coin_type_code')
      .range(from, to)
  )
}

export async function getFindsForHeatmap(): Promise<HeatmapFind[]> {
  const rows = await fetchAllPages<{
    coin_type_code: string | null
    context_code: string | null
    quantity_total: number | null
    quantity_min: number | null
    quantity_estimated: number | null
    presence: string | boolean | null
    contexts: { site_code: string } | { site_code: string }[]
  }>((from, to) =>
    supabase
      .from('finds')
      .select(
        'coin_type_code, context_code, quantity_total, quantity_min, quantity_estimated, presence, contexts!inner(site_code)'
      )
      .order('find_code')
      .range(from, to)
  )

  return rows.map((row) => {
    const context = Array.isArray(row.contexts) ? row.contexts[0] : row.contexts
    return {
      coin_type_code: row.coin_type_code,
      context_code: row.context_code,
      quantity_total: row.quantity_total,
      quantity_min: row.quantity_min,
      quantity_estimated: row.quantity_estimated,
      presence: typeof row.presence === 'boolean' ? row.presence : null,
      site_code: context?.site_code ?? '',
    }
  })
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

/** Returns mint-issued coin findspots based on finds+coin_types in current DB. */
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

  const finds = await fetchAllPages<{
    find_code: string
    context_code: string
    coin_type_code: string | null
  }>((from, to) =>
    supabase
      .from('finds')
      .select('find_code, context_code, coin_type_code')
      .in('coin_type_code', coinTypeCodes)
      .order('find_code')
      .range(from, to)
  )
  if (finds.length === 0) return { sites: [], typeOptions: [], siteTypeKeys: {} }

  const contextCodes = [...new Set(finds.map((f) => f.context_code).filter(Boolean))]
  const contexts = await fetchAllPages<{ context_code: string; site_code: string }>((from, to) =>
    supabase
      .from('contexts')
      .select('context_code, site_code')
      .in('context_code', contextCodes)
      .order('context_code')
      .range(from, to)
  )

  const contextToSite = new Map<string, string>()
  contexts.forEach((ctx) => contextToSite.set(ctx.context_code, ctx.site_code))

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

  const sites = await fetchAllPages<MapSite>((from, to) =>
    supabase
      .from('v_coin_map_sites')
      .select(MAP_SITE_FIELDS)
      .in('site_code', siteCodes)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('site_code')
      .range(from, to)
  )

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

  return { sites, typeOptions, siteTypeKeys }
}
