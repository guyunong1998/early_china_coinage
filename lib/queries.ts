import { splitCsv } from '@/lib/format'
import { getMintNameVariants } from '@/lib/mint-towns'
import { supabase } from '@/lib/supabase'
import type {
  CoinIssueDisplay,
  CoinTypeHierarchyRow,
  Context,
  DatabaseStats,
  Find,
  HeatmapFind,
  MapSite,
  Site,
  Source,
} from '@/lib/types'

const MAP_SITE_FIELDS =
  'site_code, site_name_zh, site_name_en, province_zh, province_en, city_zh, city_en, county_zh, county_en, location_detail_zh, location_detail_en, lat, lng, precision_level, site_type_zh, site_type_en, find_record_count, total_quantity_for_map, level1_types_zh, level2_types_zh, level3_types_zh, level4_types_zh, level5_types_zh, inscriptions, states_zh, mints_zh'

export type SearchSite = MapSite & { period_zh: string | null; period_en: string | null }

/** Without generated Database types, supabase-js/postgrest-js can't always
 * infer a to-one embed's cardinality from the select string alone and
 * sometimes types it as an array — same ambiguity getFindsForHeatmap's
 * `contexts` field below already works around. Normalizes either shape to a
 * single row. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type CoinTypeHierarchyFields = {
  level1_zh: string | null
  level1_en: string | null
  level2_zh: string | null
  level2_en: string | null
  level3_zh: string | null
  level3_en: string | null
  level4_zh: string | null
  level4_en: string | null
  level5_zh: string | null
  level5_en: string | null
}

/** Raw shape of a coin_type_hierarchy embed as returned by PostgREST. */
type CoinTypeHierarchyEmbed = CoinTypeHierarchyFields | CoinTypeHierarchyFields[] | null

/**
 * coin_type_hierarchy.level1_zh isn't a single fixed root — it's '钱币' for
 * ordinary coins (major type one level down, at level2) but also '钱范'
 * (coin moulds) as its own top-level category (major type is level1
 * itself). Derive "major/minor type" text accordingly rather than assuming
 * level1 is always '钱币'.
 */
function deriveMajorMinor(cthRaw: CoinTypeHierarchyEmbed) {
  const cth = one(cthRaw)
  if (!cth) return { major_zh: null, major_en: null, minor_zh: null, minor_en: null }
  const isCoin = cth.level1_zh === '钱币'
  return {
    major_zh: isCoin ? cth.level2_zh : cth.level1_zh,
    major_en: isCoin ? cth.level2_en : cth.level1_en,
    minor_zh: isCoin
      ? cth.level5_zh ?? cth.level4_zh ?? cth.level3_zh ?? null
      : cth.level5_zh ?? cth.level4_zh ?? cth.level3_zh ?? cth.level2_zh ?? null,
    minor_en: isCoin
      ? cth.level5_en ?? cth.level4_en ?? cth.level3_en ?? null
      : cth.level5_en ?? cth.level4_en ?? cth.level3_en ?? cth.level2_en ?? null,
  }
}

/** Raw shape of a coin_issues row joined to its four FK tables, as returned
 * by PostgREST — the embed shape used both for `.from('coin_issues')` and
 * for `.from('finds').select('*, coin_issues(...)')`. Each joined relation
 * may come back as an object or a single-element array (see `one` above). */
type CoinIssueEmbed = {
  coin_type_code: string
  description_zh: string | null
  description_en: string | null
  mint_id: string | null
  state_id: string | null
  inscription_id: string | null
  coin_type_hierarchy_id: string | null
  mints: { name_zh: string; name_en: string | null } | { name_zh: string; name_en: string | null }[] | null
  states: { state_zh: string; state_en: string | null } | { state_zh: string; state_en: string | null }[] | null
  inscriptions:
    | { inscription_zh: string; inscription_en: string | null }
    | { inscription_zh: string; inscription_en: string | null }[]
    | null
  coin_type_hierarchy: CoinTypeHierarchyEmbed
}

const COIN_ISSUE_FIELDS =
  'coin_type_code, description_zh, description_en, mint_id, state_id, inscription_id, coin_type_hierarchy_id, mints(name_zh, name_en), states(state_zh, state_en), inscriptions(inscription_zh, inscription_en), coin_type_hierarchy(level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en)'

/** Flattens a joined coin_issues row into the same flat zh/en text shape the
 * old coin_types table provided, plus the FK ids for match-logic callers
 * (see lib/typology-filter.ts, lib/mint-filter.ts). */
function flattenCoinIssue(row: CoinIssueEmbed): CoinIssueDisplay {
  const { major_zh, major_en, minor_zh, minor_en } = deriveMajorMinor(row.coin_type_hierarchy)
  const mint = one(row.mints)
  const state = one(row.states)
  const inscription = one(row.inscriptions)
  return {
    coin_type_code: row.coin_type_code,
    major_type_zh: major_zh,
    major_type_en: major_en,
    minor_type_zh: minor_zh,
    minor_type_en: minor_en,
    inscription: inscription?.inscription_zh ?? null,
    inscription_en: inscription?.inscription_en ?? null,
    mint_zh: mint?.name_zh ?? null,
    mint_en: mint?.name_en ?? null,
    state_zh: state?.state_zh ?? null,
    state_en: state?.state_en ?? null,
    description_zh: row.description_zh,
    description_en: row.description_en,
    mint_id: row.mint_id,
    state_id: row.state_id,
    inscription_id: row.inscription_id,
    coin_type_hierarchy_id: row.coin_type_hierarchy_id,
  }
}

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
export async function fetchAllPages<T>(
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
    level1_types_zh: null,
    level2_types_zh: null,
    level3_types_zh: null,
    level4_types_zh: null,
    level5_types_zh: null,
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
    .select(`*, coin_issues(${COIN_ISSUE_FIELDS})`)
    .in('context_code', contextCodes)
    .order('find_code')

  if (error) throw error
  return (
    (data ?? []) as Array<Omit<Find, 'coin_issues'> & { coin_issues: CoinIssueEmbed | CoinIssueEmbed[] | null }>
  ).map((row) => {
    const coinIssue = one(row.coin_issues)
    return {
      ...row,
      coin_issues: coinIssue ? flattenCoinIssue(coinIssue) : null,
    }
  })
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
 *    to its Chinese equivalent via the coin_issues catalog before it can match.
 * 2. Site period isn't on the view at all — it's joined in from `sites` — so it
 *    can't be expressed as a single SQL OR clause against v_coin_map_sites.
 */
export async function searchSites(query: string): Promise<SearchSite[]> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const [sites, coinIssues] = await Promise.all([getAllSites(), getCoinIssues()])

  const zhTerms = new Set<string>()
  coinIssues.forEach((c) => {
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
      textIncludes(site.level1_types_zh, trimmed) ||
      textIncludes(site.level2_types_zh, trimmed) ||
      textIncludes(site.level3_types_zh, trimmed) ||
      textIncludes(site.level4_types_zh, trimmed) ||
      textIncludes(site.level5_types_zh, trimmed) ||
      textIncludes(site.inscriptions, trimmed) ||
      textIncludes(site.states_zh, trimmed) ||
      textIncludes(site.mints_zh, trimmed) ||
      textIncludes(site.site_code, trimmed)

    if (directMatch) return true
    if (zhTerms.size === 0) return false

    return [...zhTerms].some(
      (term) =>
        splitCsv(site.level1_types_zh).includes(term) ||
        splitCsv(site.level2_types_zh).includes(term) ||
        splitCsv(site.level3_types_zh).includes(term) ||
        splitCsv(site.level4_types_zh).includes(term) ||
        splitCsv(site.level5_types_zh).includes(term) ||
        splitCsv(site.inscriptions).includes(term) ||
        splitCsv(site.states_zh).includes(term) ||
        splitCsv(site.mints_zh).includes(term)
    )
  })
}

export async function getCoinIssues(): Promise<CoinIssueDisplay[]> {
  const rows = await fetchAllPages<CoinIssueEmbed>((from, to) =>
    supabase.from('coin_issues').select(COIN_ISSUE_FIELDS).order('coin_type_code').range(from, to)
  )
  return rows.map(flattenCoinIssue)
}

export async function getCoinTypeHierarchy(): Promise<CoinTypeHierarchyRow[]> {
  return fetchAllPages<CoinTypeHierarchyRow>((from, to) =>
    supabase
      .from('coin_type_hierarchy')
      .select(
        'id, level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en, img_acc_num'
      )
      .order('level2_zh')
      .range(from, to)
  )
}

export type MintRow = {
  id: string
  name_zh: string
  name_en: string
  precision_level: number | null
  latitude: number | null
  longitude: number | null
  description_zh: string | null
  description_en: string | null
  citation: string | null
}

export async function getMints(): Promise<MintRow[]> {
  return fetchAllPages<MintRow>((from, to) =>
    supabase
      .from('mints')
      .select('id, name_zh, name_en, precision_level, latitude, longitude, description_zh, description_en, citation')
      .order('name_zh')
      .range(from, to)
  )
}

export async function getFindsForHeatmap(): Promise<HeatmapFind[]> {
  const rows = await fetchAllPages<{
    coin_issues: { coin_type_code: string } | { coin_type_code: string }[] | null
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
        'coin_issues(coin_type_code), context_code, quantity_total, quantity_min, quantity_estimated, presence, contexts!inner(site_code)'
      )
      .order('find_code')
      .range(from, to)
  )

  return rows.map((row) => {
    const context = Array.isArray(row.contexts) ? row.contexts[0] : row.contexts
    const coinIssue = one(row.coin_issues)
    return {
      coin_type_code: coinIssue?.coin_type_code ?? null,
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
  /** Every inscription catalogued for this mint in coin_issues, regardless of
   * whether a find has been recorded for it yet. */
  inscriptions: string[]
  /** Total coin quantity across all finds attributed to this mint. */
  totalCoinCount: number
  /** Distinct find sites — not the same as `sites.length`, which only
   * counts sites with known coordinates. */
  siteCount: number
}

const EMPTY_MINT_FINDSPOTS_DATA: MintFindspotsData = {
  sites: [],
  typeOptions: [],
  siteTypeKeys: {},
  inscriptions: [],
  totalCoinCount: 0,
  siteCount: 0,
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

/** Returns mint-issued coin findspots based on finds+coin_issues in current DB.
 * `mintZh` is resolved to a live `mints.id` (via known name variants) before
 * querying — coin_issues links to mints by id, not by text. */
export async function getMintFindspotsData(mintZh: string): Promise<MintFindspotsData> {
  if (!mintZh) return EMPTY_MINT_FINDSPOTS_DATA

  const variants = getMintNameVariants(mintZh)
  const { data: mintRows, error: mintError } = await supabase.from('mints').select('id').in('name_zh', variants)

  if (mintError) throw mintError
  const mintIds = (mintRows ?? []).map((row) => row.id)
  if (mintIds.length === 0) return EMPTY_MINT_FINDSPOTS_DATA

  const { data: mintedIssueRows, error: coinError } = await supabase
    .from('coin_issues')
    .select(
      'id, coin_type_code, mint_id, inscriptions(inscription_zh, inscription_en), coin_type_hierarchy(level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en)'
    )
    .in('mint_id', mintIds)

  if (coinError) throw coinError
  if (!mintedIssueRows || mintedIssueRows.length === 0) {
    return EMPTY_MINT_FINDSPOTS_DATA
  }

  const mintedCoinTypes = (
    mintedIssueRows as Array<{
      id: string
      coin_type_code: string
      mint_id: string | null
      inscriptions:
        | { inscription_zh: string; inscription_en: string | null }
        | { inscription_zh: string; inscription_en: string | null }[]
        | null
      coin_type_hierarchy: CoinTypeHierarchyEmbed
    }>
  ).map((row) => {
    const { major_zh, minor_zh } = deriveMajorMinor(row.coin_type_hierarchy)
    return {
      id: row.id,
      coin_type_code: row.coin_type_code,
      major_type_zh: major_zh,
      minor_type_zh: minor_zh,
      inscription: one(row.inscriptions)?.inscription_zh ?? null,
    }
  })

  // Full catalogue of inscriptions attributed to this mint — independent of
  // whether any find has been recorded yet, so this stays complete even for
  // mints with a thin excavation record.
  const inscriptions = [...new Set(mintedCoinTypes.map((row) => row.inscription?.trim()).filter((v): v is string => !!v))].sort(
    (a, b) => a.localeCompare(b, 'zh-CN')
  )

  const coinIssueIds = mintedCoinTypes.map((row) => row.id).filter(Boolean)
  if (coinIssueIds.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions }

  const finds = await fetchAllPages<{
    find_code: string
    context_code: string
    coin_issues_id: string | null
    quantity_total: number | null
    quantity_estimated: number | null
    quantity_min: number | null
  }>((from, to) =>
    supabase
      .from('finds')
      .select('find_code, context_code, coin_issues_id, quantity_total, quantity_estimated, quantity_min')
      .in('coin_issues_id', coinIssueIds)
      .order('find_code')
      .range(from, to)
  )
  if (finds.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions }

  const totalCoinCount = finds.reduce(
    (sum, f) => sum + (f.quantity_total ?? f.quantity_estimated ?? f.quantity_min ?? 0),
    0
  )

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

  const idToTypeRow = new Map(
    mintedCoinTypes.map((row) => [row.id, row] as const)
  )

  finds.forEach((find) => {
    const siteCode = contextToSite.get(find.context_code)
    if (!siteCode) return
    const typeRow = idToTypeRow.get(find.coin_issues_id ?? '')
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
  if (siteCodes.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions, totalCoinCount }

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

  return { sites, typeOptions, siteTypeKeys, inscriptions, totalCoinCount, siteCount: siteCodeSet.size }
}
