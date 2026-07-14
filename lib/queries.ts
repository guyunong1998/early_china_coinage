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
  const { data, error } = await supabase
    .from('v_coin_map_sites')
    .select(MAP_SITE_FIELDS)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) throw error
  return data ?? []
}

export async function getAllSites(): Promise<SearchSite[]> {
  const { data, error } = await supabase
    .from('v_coin_map_sites')
    .select(MAP_SITE_FIELDS)
    .order('site_name_zh')

  if (error) throw error
  return attachPeriods(data ?? [])
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

  // Translate any English coin-type/mint/state terms in the query to their
  // Chinese equivalents so they can be matched against the Chinese-only fields.
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
  const { data, error } = await supabase
    .from('coin_types')
    .select('*')
    .order('major_type_zh')
    .order('minor_type_zh')
    .order('inscription')

  if (error) throw error
  return data ?? []
}

export async function getFindsForHeatmap(): Promise<HeatmapFind[]> {
  const { data, error } = await supabase
    .from('finds')
    .select(
      'coin_type_code, quantity_total, quantity_min, quantity_estimated, presence, contexts!inner(site_code)'
    )

  if (error) throw error
  return (data ?? []).map((row) => {
    const context = Array.isArray(row.contexts) ? row.contexts[0] : row.contexts
    return {
      coin_type_code: row.coin_type_code,
      quantity_total: row.quantity_total,
      quantity_min: row.quantity_min,
      quantity_estimated: row.quantity_estimated,
      presence: row.presence,
      site_code: context?.site_code ?? '',
    }
  })
}
