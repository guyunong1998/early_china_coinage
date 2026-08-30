import { splitCsv } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { matchHierarchyForLegacyType, parseLegacyTypeTokens } from '@/lib/typology-filter'
import type {
  CoinIssueDisplay,
  CoinTypeHierarchyRow,
  Context,
  DatabaseStats,
  Find,
  HeatmapFind,
  ImageRecord,
  Inscription,
  MapSite,
  Site,
  Source,
  SourceLink,
  State,
} from '@/lib/types'

const MAP_SITE_FIELDS =
  'site_code, site_name_zh, site_name_en, province_zh, province_en, city_zh, city_en, county_zh, county_en, location_detail_zh, location_detail_en, lat, lng, precision_level, site_type_zh, site_type_en, find_record_count, total_quantity_for_map, level1_types_zh, level2_types_zh, level3_types_zh, level4_types_zh, level5_types_zh, level1_types_en, level2_types_en, level3_types_en, level4_types_en, level5_types_en, inscriptions, states_zh, mints_zh, inscriptions_en, states_en, mints_en'

export type SearchSite = MapSite & {
  period_zh: string | null
  period_en: string | null
  // Carried along for /search's "interest" sort (lib/search-filters.ts),
  // which rewards a site that has a description — not exposed on the
  // v_coin_map_sites view MapSite otherwise comes from, so this is
  // fetched from `sites` alongside period in attachSiteDetails below.
  description_zh: string | null
  description_en: string | null
}

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
export type CoinIssueEmbed = {
  id: string
  coin_type_code: string
  description_zh: string | null
  description_en: string | null
  mint_id: string | null
  state_id: string | null
  inscription_id: string | null
  coin_type_hierarchy_id: string | null
  legacy_type?: string | null
  legacy_inscription?: string | null
  legacy_mint?: string | null
  legacy_state?: string | null
  mints: { name_zh: string; name_en: string | null } | { name_zh: string; name_en: string | null }[] | null
  states: { state_zh: string; state_en: string | null } | { state_zh: string; state_en: string | null }[] | null
  inscriptions:
    | { inscription_zh: string; inscription_en: string | null }
    | { inscription_zh: string; inscription_en: string | null }[]
    | null
  coin_type_hierarchy: CoinTypeHierarchyEmbed
}

export const COIN_ISSUE_FIELDS =
  'id, coin_type_code, description_zh, description_en, mint_id, state_id, inscription_id, coin_type_hierarchy_id, legacy_type, legacy_inscription, legacy_mint, legacy_state, mints(name_zh, name_en), states(state_zh, state_en), inscriptions(inscription_zh, inscription_en), coin_type_hierarchy(level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en)'

type LegacyTypeFields = {
  legacy_type?: string | null
  legacy_inscription?: string | null
  legacy_mint?: string | null
  legacy_state?: string | null
}

/** When coin_type_hierarchy_id is null, resolve type text from legacy_type
 * against the live hierarchy (and fall back to the raw tokens if no row
 * matches) so finds that only have coin_issues_id still display and filter. */
function applyLegacyHierarchy(
  issue: CoinIssueDisplay,
  legacy: LegacyTypeFields | null | undefined,
  hierarchyRows?: CoinTypeHierarchyRow[]
): CoinIssueDisplay {
  if (issue.coin_type_hierarchy_id && issue.major_type_zh) {
    return {
      ...issue,
      inscription: issue.inscription ?? legacy?.legacy_inscription ?? null,
      mint_zh: issue.mint_zh ?? legacy?.legacy_mint ?? null,
      state_zh: issue.state_zh ?? legacy?.legacy_state ?? null,
    }
  }

  const matched =
    !issue.coin_type_hierarchy_id && hierarchyRows?.length
      ? matchHierarchyForLegacyType(legacy?.legacy_type, hierarchyRows)
      : null
  const derived = matched ? deriveMajorMinor(matched) : { major_zh: null, major_en: null, minor_zh: null, minor_en: null }
  const tokens = parseLegacyTypeTokens(legacy?.legacy_type)
  return {
    ...issue,
    coin_type_hierarchy_id: issue.coin_type_hierarchy_id ?? matched?.id ?? null,
    major_type_zh: issue.major_type_zh ?? derived.major_zh ?? tokens[0] ?? null,
    major_type_en: issue.major_type_en ?? derived.major_en ?? null,
    minor_type_zh: issue.minor_type_zh ?? derived.minor_zh ?? tokens[1] ?? null,
    minor_type_en: issue.minor_type_en ?? derived.minor_en ?? null,
    level2_zh: issue.level2_zh ?? matched?.level2_zh ?? tokens[0] ?? null,
    level2_en: issue.level2_en ?? matched?.level2_en ?? null,
    inscription: issue.inscription ?? legacy?.legacy_inscription ?? null,
    mint_zh: issue.mint_zh ?? legacy?.legacy_mint ?? null,
    state_zh: issue.state_zh ?? legacy?.legacy_state ?? null,
  }
}

/** Flattens a joined coin_issues row into the same flat zh/en text shape the
 * old coin_types table provided, plus the FK ids for match-logic callers
 * (see lib/typology-filter.ts, lib/mint-filter.ts). Pass `hierarchyRows` so
 * issues with a null coin_type_hierarchy_id still resolve via legacy_type. */
export function flattenCoinIssue(row: CoinIssueEmbed, hierarchyRows?: CoinTypeHierarchyRow[]): CoinIssueDisplay {
  const cth = one(row.coin_type_hierarchy)
  const { major_zh, major_en, minor_zh, minor_en } = deriveMajorMinor(cth)
  const mint = one(row.mints)
  const state = one(row.states)
  const inscription = one(row.inscriptions)
  return applyLegacyHierarchy(
    {
      id: row.id,
      coin_type_code: row.coin_type_code,
      major_type_zh: major_zh,
      major_type_en: major_en,
      minor_type_zh: minor_zh,
      minor_type_en: minor_en,
      level2_zh: cth?.level2_zh ?? null,
      level2_en: cth?.level2_en ?? null,
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
    },
    row,
    hierarchyRows
  )
}

function splitSourceCodes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function addCsvValue(set: Set<string>, value: string | null | undefined) {
  const v = value?.trim()
  if (v) set.add(v)
}

function csvFromSet(set: Set<string>): string | null {
  if (set.size === 0) return null
  return [...set].join('、')
}

function unionCsv(a: string | null | undefined, b: string | null | undefined): string | null {
  const set = new Set([...splitCsv(a), ...splitCsv(b)])
  return set.size ? [...set].join('、') : null
}

type MapSiteTypeFields = Pick<
  MapSite,
  | 'level1_types_zh'
  | 'level2_types_zh'
  | 'level3_types_zh'
  | 'level4_types_zh'
  | 'level5_types_zh'
  | 'level1_types_en'
  | 'level2_types_en'
  | 'level3_types_en'
  | 'level4_types_en'
  | 'level5_types_en'
  | 'inscriptions'
  | 'inscriptions_en'
  | 'states_zh'
  | 'states_en'
  | 'mints_zh'
  | 'mints_en'
>

function emptyTypeBuckets() {
  return {
    level1_zh: new Set<string>(),
    level1_en: new Set<string>(),
    level2_zh: new Set<string>(),
    level2_en: new Set<string>(),
    level3_zh: new Set<string>(),
    level3_en: new Set<string>(),
    level4_zh: new Set<string>(),
    level4_en: new Set<string>(),
    level5_zh: new Set<string>(),
    level5_en: new Set<string>(),
    inscriptions: new Set<string>(),
    inscriptions_en: new Set<string>(),
    states_zh: new Set<string>(),
    states_en: new Set<string>(),
    mints_zh: new Set<string>(),
    mints_en: new Set<string>(),
  }
}

function addIssueToTypeBuckets(
  buckets: ReturnType<typeof emptyTypeBuckets>,
  issue: CoinIssueDisplay,
  hierarchyById: Map<string, CoinTypeHierarchyRow>
) {
  const row = issue.coin_type_hierarchy_id ? hierarchyById.get(issue.coin_type_hierarchy_id) : undefined
  if (row) {
    addCsvValue(buckets.level1_zh, row.level1_zh)
    addCsvValue(buckets.level1_en, row.level1_en)
    addCsvValue(buckets.level2_zh, row.level2_zh)
    addCsvValue(buckets.level2_en, row.level2_en)
    addCsvValue(buckets.level3_zh, row.level3_zh)
    addCsvValue(buckets.level3_en, row.level3_en)
    addCsvValue(buckets.level4_zh, row.level4_zh)
    addCsvValue(buckets.level4_en, row.level4_en)
    addCsvValue(buckets.level5_zh, row.level5_zh)
    addCsvValue(buckets.level5_en, row.level5_en)
  } else {
    addCsvValue(buckets.level2_zh, issue.level2_zh ?? issue.major_type_zh)
    addCsvValue(buckets.level2_en, issue.level2_en ?? issue.major_type_en)
    addCsvValue(buckets.level3_zh, issue.minor_type_zh)
    addCsvValue(buckets.level3_en, issue.minor_type_en)
  }
  addCsvValue(buckets.inscriptions, issue.inscription)
  addCsvValue(buckets.inscriptions_en, issue.inscription_en)
  addCsvValue(buckets.states_zh, issue.state_zh)
  addCsvValue(buckets.states_en, issue.state_en)
  addCsvValue(buckets.mints_zh, issue.mint_zh)
  addCsvValue(buckets.mints_en, issue.mint_en)
}

function bucketsToTypeFields(buckets: ReturnType<typeof emptyTypeBuckets>): MapSiteTypeFields {
  return {
    level1_types_zh: csvFromSet(buckets.level1_zh),
    level2_types_zh: csvFromSet(buckets.level2_zh),
    level3_types_zh: csvFromSet(buckets.level3_zh),
    level4_types_zh: csvFromSet(buckets.level4_zh),
    level5_types_zh: csvFromSet(buckets.level5_zh),
    level1_types_en: csvFromSet(buckets.level1_en),
    level2_types_en: csvFromSet(buckets.level2_en),
    level3_types_en: csvFromSet(buckets.level3_en),
    level4_types_en: csvFromSet(buckets.level4_en),
    level5_types_en: csvFromSet(buckets.level5_en),
    inscriptions: csvFromSet(buckets.inscriptions),
    inscriptions_en: csvFromSet(buckets.inscriptions_en),
    states_zh: csvFromSet(buckets.states_zh),
    states_en: csvFromSet(buckets.states_en),
    mints_zh: csvFromSet(buckets.mints_zh),
    mints_en: csvFromSet(buckets.mints_en),
  }
}

function unionMapSiteTypeFields(site: MapSite, extra: MapSiteTypeFields): MapSite {
  return {
    ...site,
    level1_types_zh: unionCsv(site.level1_types_zh, extra.level1_types_zh),
    level2_types_zh: unionCsv(site.level2_types_zh, extra.level2_types_zh),
    level3_types_zh: unionCsv(site.level3_types_zh, extra.level3_types_zh),
    level4_types_zh: unionCsv(site.level4_types_zh, extra.level4_types_zh),
    level5_types_zh: unionCsv(site.level5_types_zh, extra.level5_types_zh),
    level1_types_en: unionCsv(site.level1_types_en, extra.level1_types_en),
    level2_types_en: unionCsv(site.level2_types_en, extra.level2_types_en),
    level3_types_en: unionCsv(site.level3_types_en, extra.level3_types_en),
    level4_types_en: unionCsv(site.level4_types_en, extra.level4_types_en),
    level5_types_en: unionCsv(site.level5_types_en, extra.level5_types_en),
    inscriptions: unionCsv(site.inscriptions, extra.inscriptions),
    inscriptions_en: unionCsv(site.inscriptions_en, extra.inscriptions_en),
    states_zh: unionCsv(site.states_zh, extra.states_zh),
    states_en: unionCsv(site.states_en, extra.states_en),
    mints_zh: unionCsv(site.mints_zh, extra.mints_zh),
    mints_en: unionCsv(site.mints_en, extra.mints_en),
  }
}

function typeFieldsFromIssues(
  issues: CoinIssueDisplay[],
  hierarchyRows: CoinTypeHierarchyRow[]
): MapSiteTypeFields {
  const hierarchyById = new Map(hierarchyRows.map((row) => [row.id, row]))
  const buckets = emptyTypeBuckets()
  issues.forEach((issue) => addIssueToTypeBuckets(buckets, issue, hierarchyById))
  return bucketsToTypeFields(buckets)
}

/** Overlay type/mint/inscription/state CSVs from each find's coin_issues
 * (including legacy_type → hierarchy fallback) onto a v_coin_map_sites row
 * so sites whose view columns are empty still show types in map popups and
 * the site classification panel. */
export function overlayMapSiteTypesFromFinds(
  site: MapSite | null,
  finds: Find[],
  hierarchyRows: CoinTypeHierarchyRow[]
): MapSite | null {
  if (!site) return null
  const issues = finds.map((find) => find.coin_issues).filter((issue): issue is CoinIssueDisplay => issue != null)
  if (issues.length === 0) return site
  return unionMapSiteTypeFields(site, typeFieldsFromIssues(issues, hierarchyRows))
}

function siteHasTypeCsv(site: MapSite): boolean {
  return !!(
    site.level1_types_zh ||
    site.level2_types_zh ||
    site.level3_types_zh ||
    site.level4_types_zh ||
    site.level5_types_zh
  )
}

/** Sites whose map-view type CSVs are empty (typically finds that only have
 * coin_issues_id, whose issue has no coin_type_hierarchy_id) get those
 * columns rebuilt from finds → coin_issues → hierarchy/legacy_type. */
async function fillMissingMapSiteTypes(sites: MapSite[]): Promise<MapSite[]> {
  const missing = sites.filter((site) => (site.find_record_count ?? 0) > 0 && !siteHasTypeCsv(site))
  if (missing.length === 0) return sites

  const finds = await getFindsForSiteCodes(missing.map((site) => site.site_code))
  const issueIds = [...new Set(finds.map((find) => find.coin_issues_id).filter((id): id is string => !!id))]
  if (issueIds.length === 0) return sites

  const [issueRows, hierarchyRows] = await Promise.all([
    fetchAllPages<CoinIssueEmbed>((from, to) =>
      supabase.from('coin_issues').select(COIN_ISSUE_FIELDS).in('id', issueIds).order('coin_type_code').range(from, to)
    ),
    getCoinTypeHierarchy(),
  ])
  const issueById = new Map(issueRows.map((row) => [row.id, flattenCoinIssue(row, hierarchyRows)]))
  const extraBySite = new Map<string, CoinIssueDisplay[]>()
  finds.forEach((find) => {
    if (!find.site_code || !find.coin_issues_id) return
    const issue = issueById.get(find.coin_issues_id)
    if (!issue) return
    const list = extraBySite.get(find.site_code) ?? []
    list.push(issue)
    extraBySite.set(find.site_code, list)
  })

  return sites.map((site) => {
    const issues = extraBySite.get(site.site_code)
    if (!issues?.length) return site
    return unionMapSiteTypeFields(site, typeFieldsFromIssues(issues, hierarchyRows))
  })
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

/** Raw shape of a `periods(period_zh, period_en)` embed, as returned by
 * PostgREST for a to-one FK (see `one` above for the array-vs-object
 * ambiguity this works around). */
type PeriodEmbed =
  | { period_zh: string | null; period_en: string | null }
  | { period_zh: string | null; period_en: string | null }[]
  | null

/** Flattens a row carrying an embedded `periods(...)` relation into the same
 * flat period_zh/period_en shape `sites`/`contexts` exposed before period
 * was normalized into its own lookup table. */
// row comes straight off the untyped supabase-js client (see lib/supabase.ts);
// callers cast the result to their target row type (Site, Context, ...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenPeriod(row: any) {
  const { periods, ...rest } = row
  const period = one(periods as PeriodEmbed)
  return { ...rest, period_zh: period?.period_zh ?? null, period_en: period?.period_en ?? null }
}

async function attachSiteDetails(sites: MapSite[]): Promise<SearchSite[]> {
  try {
    // Paginate — sites exceed PostgREST's default 1000-row cap, and a single
    // unpaginated select silently dropped periods for later rows. Bundles
    // description alongside period (rather than a second query) since both
    // come off the same `sites` row keyed by the same site_code.
    const data = await fetchAllPages<{
      site_code: string
      description_zh: string | null
      description_en: string | null
      periods:
        | { period_zh: string | null; period_en: string | null }
        | { period_zh: string | null; period_en: string | null }[]
        | null
    }>((from, to) =>
      supabase
        .from('sites')
        .select('site_code, description_zh, description_en, periods(period_zh, period_en)')
        .order('site_code')
        .range(from, to)
    )

    const detailsBySiteCode = new Map(data.map((row) => [row.site_code, flattenPeriod(row)]))
    return sites.map((site) => {
      const details = detailsBySiteCode.get(site.site_code)
      return {
        ...site,
        period_zh: details?.period_zh ?? null,
        period_en: details?.period_en ?? null,
        description_zh: details?.description_zh ?? null,
        description_en: details?.description_en ?? null,
      }
    })
  } catch (err) {
    // Don't take down /search (or any attachSiteDetails caller) if the
    // periods embed/migration is missing — degrade to nulls instead.
    console.error('attachSiteDetails failed; continuing without period/description labels:', err)
    return sites.map((site) => ({
      ...site,
      period_zh: null,
      period_en: null,
      description_zh: null,
      description_en: null,
    }))
  }
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
    level1_types_en: null,
    level2_types_en: null,
    level3_types_en: null,
    level4_types_en: null,
    level5_types_en: null,
    inscriptions: null,
    states_zh: null,
    mints_zh: null,
    inscriptions_en: null,
    states_en: null,
    mints_en: null,
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
  return fillMissingMapSiteTypes(mergeMapSites(mapped, supplements))
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
  const filled = await fillMissingMapSiteTypes(mergeMapSites(sites, supplements))
  return attachSiteDetails(filled)
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
    .select('*, periods(period_zh, period_en)')
    .eq('site_code', siteCode)
    .maybeSingle()

  if (error) throw error
  return data ? flattenPeriod(data) : null
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
    .select('*, periods(period_zh, period_en)')
    .eq('site_code', siteCode)
    .order('context_code')

  if (error) throw error
  return (data ?? []).map(flattenPeriod)
}

export async function getSiteFinds(
  contextCodes: string[],
  hierarchyRows?: CoinTypeHierarchyRow[]
): Promise<Find[]> {
  if (contextCodes.length === 0) return []

  const { data, error } = await supabase
    .from('finds')
    .select(`*, coin_issues(${COIN_ISSUE_FIELDS})`)
    .in('context_code', contextCodes)
    .order('find_code')

  if (error) throw error
  const rows = (data ?? []) as Array<
    Omit<Find, 'coin_issues'> & { coin_issues: CoinIssueEmbed | CoinIssueEmbed[] | null }
  >
  const needsLegacy =
    !hierarchyRows &&
    rows.some((row) => {
      const coinIssue = one(row.coin_issues)
      return !!coinIssue && !coinIssue.coin_type_hierarchy_id
    })
  const hierarchy = needsLegacy ? await getCoinTypeHierarchy() : hierarchyRows

  return rows.map((row) => {
    const coinIssue = one(row.coin_issues)
    return {
      ...row,
      coin_issues: coinIssue ? flattenCoinIssue(coinIssue, hierarchy) : null,
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
/** Pure filter used by /search — keeps network IO in the page so sites +
 * coinIssues are fetched once (searchSites used to re-fetch both, which
 * could push Vercel hobby's ~10s function limit and make /search hang). */
export function filterSitesByQuery(
  sites: SearchSite[],
  coinIssues: CoinIssueDisplay[],
  query: string
): SearchSite[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return sites

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
      textIncludes(site.level1_types_en, trimmed) ||
      textIncludes(site.level2_types_en, trimmed) ||
      textIncludes(site.level3_types_en, trimmed) ||
      textIncludes(site.level4_types_en, trimmed) ||
      textIncludes(site.level5_types_en, trimmed) ||
      textIncludes(site.inscriptions, trimmed) ||
      textIncludes(site.inscriptions_en, trimmed) ||
      textIncludes(site.states_zh, trimmed) ||
      textIncludes(site.states_en, trimmed) ||
      textIncludes(site.mints_zh, trimmed) ||
      textIncludes(site.mints_en, trimmed) ||
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

export async function searchSites(query: string): Promise<SearchSite[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const [sites, coinIssues] = await Promise.all([getAllSites(), getCoinIssues()])
  return filterSitesByQuery(sites, coinIssues, trimmed)
}

/** Reads the flattened, pre-joined `v_coin_issues_flat` view (mints/states/
 * inscriptions/coin_type_hierarchy already joined and major/minor derived in
 * SQL) instead of embedding + flattenCoinIssue-ing coin_issues by hand — same
 * CoinIssueDisplay shape, no client-side join. Issues whose hierarchy FK is
 * still null are then filled from legacy_type so map filters and search pies
 * see the same types as finds that still have deprecated_coin_type_code. */
export async function getCoinIssues(): Promise<CoinIssueDisplay[]> {
  const rows = await fetchAllPages<CoinIssueDisplay>((from, to) =>
    supabase.from('v_coin_issues_flat').select('*').order('coin_type_code').range(from, to)
  )
  const incomplete = rows.filter((row) => !row.coin_type_hierarchy_id)
  if (incomplete.length === 0) return rows

  const ids = incomplete.map((row) => row.id)
  const [legacyRows, hierarchyRows] = await Promise.all([
    fetchAllPages<
      { id: string } & Required<
        Pick<LegacyTypeFields, 'legacy_type' | 'legacy_inscription' | 'legacy_mint' | 'legacy_state'>
      >
    >((from, to) =>
      supabase
        .from('coin_issues')
        .select('id, legacy_type, legacy_inscription, legacy_mint, legacy_state')
        .in('id', ids)
        .order('id')
        .range(from, to)
    ),
    getCoinTypeHierarchy(),
  ])
  const legacyById = new Map(legacyRows.map((row) => [row.id, row]))
  return rows.map((row) => {
    if (row.coin_type_hierarchy_id) return row
    return applyLegacyHierarchy(row, legacyById.get(row.id) ?? null, hierarchyRows)
  })
}

export async function getCoinTypeHierarchy(): Promise<CoinTypeHierarchyRow[]> {
  return fetchAllPages<CoinTypeHierarchyRow>((from, to) =>
    supabase
      .from('coin_type_hierarchy')
      .select(
        'id, level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en, img_acc_num, description_zh, description_en'
      )
      .order('level2_zh')
      .range(from, to)
  )
}

// ── sources / source_links ──────────────────────────────────────────────

export async function getAllSources(): Promise<Source[]> {
  return fetchAllPages<Source>((from, to) =>
    supabase.from('sources').select('*').order('source_code').range(from, to)
  )
}

export async function getSource(sourceCode: string): Promise<Source | null> {
  const { data, error } = await supabase.from('sources').select('*').eq('source_code', sourceCode).maybeSingle()
  if (error) throw error
  return data
}

export async function getAllSourceLinks(): Promise<SourceLink[]> {
  return fetchAllPages<SourceLink>((from, to) =>
    supabase.from('source_links').select('*').order('source_code').range(from, to)
  )
}

export async function getSourceLinksBySourceCode(sourceCode: string): Promise<SourceLink[]> {
  const { data, error } = await supabase.from('source_links').select('*').eq('source_code', sourceCode)
  if (error) throw error
  return data ?? []
}

/**
 * source_links scoped to one site: its own site_code, its contexts'
 * context_codes, and its finds' find_codes. Deliberately excludes
 * coin_item-typed links (a site's finds have coin items too, but the
 * requirement scopes this to the site/context/find records themselves) —
 * three separate .eq/.in queries rather than one fragile OR-string, since
 * target_code isn't a real FK and the three code spaces don't overlap.
 */
// A single context can carry 300+ finds (seen live: 385), and PostgREST's
// .in() filter is serialized into the request URL, which overflows well
// before that — chunk find_codes to stay well under the header size limit.
const TARGET_CODE_BATCH_SIZE = 150

export async function getSourceLinksForSite(
  siteCode: string,
  contextCodes: string[],
  findCodes: string[]
): Promise<SourceLink[]> {
  async function linksForCodes(targetType: SourceLink['target_type'], codes: string[]): Promise<SourceLink[]> {
    if (codes.length === 0) return []
    const batches: string[][] = []
    for (let i = 0; i < codes.length; i += TARGET_CODE_BATCH_SIZE) batches.push(codes.slice(i, i + TARGET_CODE_BATCH_SIZE))
    const results = await Promise.all(
      batches.map(async (batch) => {
        const { data, error } = await supabase
          .from('source_links')
          .select('*')
          .eq('target_type', targetType)
          .in('target_code', batch)
        if (error) throw error
        return data ?? []
      })
    )
    return results.flat()
  }

  const [siteLinks, contextLinks, findLinks] = await Promise.all([
    linksForCodes('site', [siteCode]),
    linksForCodes('context', contextCodes),
    linksForCodes('find', findCodes),
  ])

  return [...siteLinks, ...contextLinks, ...findLinks]
}

/** source_links scoped to one mint — no child records to also pull in
 * (unlike a site's contexts/finds), so a single scoped query is enough. */
export async function getSourceLinksForMint(mintCode: string): Promise<SourceLink[]> {
  const { data, error } = await supabase
    .from('source_links')
    .select('*')
    .eq('target_type', 'mint')
    .eq('target_code', mintCode)
  if (error) throw error
  return data ?? []
}

export async function getStates(): Promise<State[]> {
  return fetchAllPages<State>((from, to) =>
    supabase.from('states').select('id, state_zh, state_en').order('state_zh').range(from, to)
  )
}

export async function getInscriptions(): Promise<Inscription[]> {
  return fetchAllPages<Inscription>((from, to) =>
    supabase.from('inscriptions').select('id, inscription_zh, inscription_en').order('inscription_zh').range(from, to)
  )
}

export async function getImages(): Promise<ImageRecord[]> {
  return fetchAllPages<ImageRecord>((from, to) =>
    supabase
      .from('images')
      .select(
        'id, filename, source_id, source_text, caption_zh, caption_en, note_zh, note_en, sources(citation_zh, citation_en, url)'
      )
      .order('filename')
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
  modern_location_zh: string | null
  modern_location_en: string | null
  location_note: string | null
  state_id: string | null
  states: { state_zh: string; state_en: string | null } | { state_zh: string; state_en: string | null }[] | null
  image_ids: string[]
  sources_unlinked: string[]
  mint_code: string
  alternative_names: string[]
}

export async function getMints(): Promise<MintRow[]> {
  return fetchAllPages<MintRow>((from, to) =>
    supabase
      .from('mints')
      .select(
        'id, name_zh, name_en, precision_level, latitude, longitude, description_zh, description_en, citation, modern_location_zh, modern_location_en, location_note, state_id, states(state_zh, state_en), image_ids, sources_unlinked, mint_code, alternative_names'
      )
      .order('name_zh')
      .range(from, to)
  )
}

export async function getFindsForHeatmap(): Promise<HeatmapFind[]> {
  // coin_issues_id lives directly on `finds` (the real FK to coin_issues.id)
  // -- no embed needed to read it, and nothing here should ever touch
  // coin_type_code, which finds.* no longer carries under that name at all
  // (renamed to deprecated_coin_type_code).
  const rows = await fetchAllPages<{
    coin_issues_id: string | null
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
        'coin_issues_id, context_code, quantity_total, quantity_min, quantity_estimated, presence, contexts!inner(site_code)'
      )
      .order('find_code')
      .range(from, to)
  )

  return rows.map(mapHeatmapFindRow)
}

/** Same shape as getFindsForHeatmap, but only finds whose context belongs to
 * one of `siteCodes` — used by /search so result-list pies don't force a
 * full finds table scan on every query.
 *
 * Two-step (contexts → finds by context_code) instead of nested
 * `.in('contexts.site_code', …)`, which is unreliable/slow on PostgREST and
 * was a likely cause of Vercel function timeouts on /search. */
export async function getFindsForSiteCodes(siteCodes: string[]): Promise<HeatmapFind[]> {
  if (siteCodes.length === 0) return []
  const unique = [...new Set(siteCodes.filter(Boolean))]
  const CHUNK = 150

  try {
    const siteByContext = new Map<string, string>()
    for (let i = 0; i < unique.length; i += CHUNK) {
      const siteChunk = unique.slice(i, i + CHUNK)
      const contexts = await fetchAllPages<{ context_code: string; site_code: string }>((from, to) =>
        supabase
          .from('contexts')
          .select('context_code, site_code')
          .in('site_code', siteChunk)
          .order('context_code')
          .range(from, to)
      )
      contexts.forEach((c) => {
        if (c.context_code) siteByContext.set(c.context_code, c.site_code)
      })
    }

    const contextCodes = [...siteByContext.keys()]
    if (contextCodes.length === 0) return []

    const all: HeatmapFind[] = []
    for (let i = 0; i < contextCodes.length; i += CHUNK) {
      const contextChunk = contextCodes.slice(i, i + CHUNK)
      const rows = await fetchAllPages<{
        coin_issues_id: string | null
        context_code: string | null
        quantity_total: number | null
        quantity_min: number | null
        quantity_estimated: number | null
        presence: string | boolean | null
      }>((from, to) =>
        supabase
          .from('finds')
          .select('coin_issues_id, context_code, quantity_total, quantity_min, quantity_estimated, presence')
          .in('context_code', contextChunk)
          .order('find_code')
          .range(from, to)
      )
      rows.forEach((row) => {
        all.push({
          coin_issues_id: row.coin_issues_id,
          context_code: row.context_code,
          quantity_total: row.quantity_total,
          quantity_min: row.quantity_min,
          quantity_estimated: row.quantity_estimated,
          presence: typeof row.presence === 'boolean' ? row.presence : null,
          site_code: (row.context_code && siteByContext.get(row.context_code)) || '',
        })
      })
    }
    return all
  } catch (err) {
    // Pies are optional chrome — never take down /search if this path fails.
    console.error('getFindsForSiteCodes failed; continuing without result pies:', err)
    return []
  }
}

function mapHeatmapFindRow(row: {
  coin_issues_id: string | null
  context_code: string | null
  quantity_total: number | null
  quantity_min: number | null
  quantity_estimated: number | null
  presence: string | boolean | null
  contexts: { site_code: string } | { site_code: string }[]
}): HeatmapFind {
  const context = Array.isArray(row.contexts) ? row.contexts[0] : row.contexts
  return {
    coin_issues_id: row.coin_issues_id,
    context_code: row.context_code,
    quantity_total: row.quantity_total,
    quantity_min: row.quantity_min,
    quantity_estimated: row.quantity_estimated,
    presence: typeof row.presence === 'boolean' ? row.presence : null,
    site_code: context?.site_code ?? '',
  }
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
  inscriptions: { zh: string; en: string | null }[]
  /** Distinct coin-type labels catalogued for this mint in coin_issues
   * (deepest populated hierarchy level, minor falling back to major),
   * bilingual. */
  typeLabels: { zh: string; en: string | null }[]
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
  typeLabels: [],
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
 * Takes the mint's own `mints.id` directly — coin_issues.mint_id is a real
 * foreign key, so no name/variant matching is needed to find it. */
export async function getMintFindspotsData(mintId: string): Promise<MintFindspotsData> {
  if (!mintId) return EMPTY_MINT_FINDSPOTS_DATA

  // v_coin_issues_flat already has major/minor derived and inscription
  // flattened, so no deriveMajorMinor/one() unwrapping needed here.
  const { data: mintedIssueRows, error: coinError } = await supabase
    .from('v_coin_issues_flat')
    .select('id, coin_type_code, major_type_zh, major_type_en, minor_type_zh, minor_type_en, inscription, inscription_en')
    .eq('mint_id', mintId)

  if (coinError) throw coinError
  if (!mintedIssueRows || mintedIssueRows.length === 0) {
    return EMPTY_MINT_FINDSPOTS_DATA
  }

  const mintedCoinTypes = mintedIssueRows as Array<{
    id: string
    coin_type_code: string
    major_type_zh: string | null
    major_type_en: string | null
    minor_type_zh: string | null
    minor_type_en: string | null
    inscription: string | null
    inscription_en: string | null
  }>

  // Full catalogue of inscriptions attributed to this mint — independent of
  // whether any find has been recorded yet, so this stays complete even for
  // mints with a thin excavation record.
  const inscriptionsByZh = new Map<string, string | null>()
  mintedCoinTypes.forEach((row) => {
    const zh = row.inscription?.trim()
    if (zh && !inscriptionsByZh.has(zh)) inscriptionsByZh.set(zh, row.inscription_en)
  })
  const inscriptions = [...inscriptionsByZh.entries()]
    .map(([zh, en]) => ({ zh, en }))
    .sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))

  // Distinct coin-type labels — deepest populated level (minor, falling
  // back to major), same fallback `buildTypeLabel`/`buildTypeKey` use below.
  const typeLabelsByZh = new Map<string, string | null>()
  mintedCoinTypes.forEach((row) => {
    const zh = row.minor_type_zh ?? row.major_type_zh
    if (!zh || typeLabelsByZh.has(zh)) return
    typeLabelsByZh.set(zh, row.minor_type_zh ? row.minor_type_en : row.major_type_en)
  })
  const typeLabels = [...typeLabelsByZh.entries()]
    .map(([zh, en]) => ({ zh, en }))
    .sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))

  const coinIssueIds = mintedCoinTypes.map((row) => row.id).filter(Boolean)
  if (coinIssueIds.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions, typeLabels }

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
  if (finds.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions, typeLabels }

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
  if (siteCodes.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions, typeLabels, totalCoinCount }

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

  return { sites, typeOptions, siteTypeKeys, inscriptions, typeLabels, totalCoinCount, siteCount: siteCodeSet.size }
}
