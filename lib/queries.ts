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
