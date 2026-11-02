import { cache } from 'react'
import { and, asc, count, eq, getTableColumns, inArray, isNotNull, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  coinIssues,
  coinTypeHierarchy,
  contexts,
  finds,
  images,
  inscriptions,
  mints,
  periods,
  sites,
  sourceLinks,
  sources,
  states,
  vCoinFinds,
  vCoinIssuesFlat,
  vCoinMapSites,
  vMintStats,
} from '@/lib/db/schema'
import { splitCsv } from '@/lib/format'
import { toMintInfo, type MintTypeLabel } from '@/lib/mint-directory'
import { findQuantity } from '@/lib/quantity'
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
  MintInfo,
  Site,
  Source,
  SourceLink,
  State,
} from '@/lib/types'

/** Drizzle select object for the given columns of a table/view — the
 * equivalent of a supabase-js `select('a, b, c')` column list. */
export function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<T, K>
}

const MAP_SITE_KEYS = [
  'site_code', 'site_name_zh', 'site_name_en', 'province_zh', 'province_en', 'city_zh', 'city_en', 'county_zh', 'county_en',
  'lat', 'lng', 'precision_level', 'site_type_zh', 'site_type_en', 'find_record_count', 'total_quantity_for_map',
  'level1_types_zh', 'level2_types_zh', 'level3_types_zh', 'level4_types_zh', 'level5_types_zh',
  'level1_types_en', 'level2_types_en', 'level3_types_en', 'level4_types_en', 'level5_types_en',
  'inscriptions', 'states_zh', 'mints_zh', 'inscriptions_en', 'states_en', 'mints_en',
] as const
const MAP_SITE_FIELDS = pick(vCoinMapSites, MAP_SITE_KEYS)

// /search-only columns on v_coin_map_sites (scripts/add-v-coin-map-sites-details.sql),
// kept out of MAP_SITE_FIELDS so the map pages' payloads don't carry them.
const SEARCH_SITE_FIELDS = pick(vCoinMapSites, [
  ...MAP_SITE_KEYS, 'description_zh', 'description_en', 'period_zh', 'period_en',
] as const)

/** Columns of `sites` that line up with v_coin_map_sites's location fields,
 * for the precision-supplement / fallback lookups below. */
const SITE_PRECISION_FIELDS = pick(sites, [
  'site_code', 'site_name_zh', 'site_name_en', 'province_zh', 'province_en', 'city_zh', 'city_en', 'county_zh', 'county_en',
  'lat', 'lng', 'precision_level', 'site_type_zh', 'site_type_en',
] as const)

/** Embedded `periods(period_zh, period_en)` — pair with a leftJoin on
 * period_id, then flattenPeriod. */
export const PERIOD_EMBED = { period_zh: periods.period_zh, period_en: periods.period_en }

export type SearchSite = MapSite & {
  period_zh: string | null
  period_en: string | null
  // Carried along for /search's "interest" sort (lib/search-filters.ts),
  // which rewards a site that has a description.
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

/** coin_issues joined to its four FK tables, in the CoinIssueEmbed shape.
 * Each nested object comes back null when its left join misses, same as a
 * PostgREST embed. Selecting from coin_issues: use selectCoinIssueEmbeds. */
const COIN_ISSUE_EMBED = {
  ...pick(coinIssues, [
    'id', 'coin_type_code', 'description_zh', 'description_en', 'mint_id', 'state_id', 'inscription_id',
    'coin_type_hierarchy_id', 'legacy_inscription', 'legacy_mint', 'legacy_state',
  ] as const),
  mints: pick(mints, ['name_zh', 'name_en'] as const),
  states: pick(states, ['state_zh', 'state_en'] as const),
  inscriptions: pick(inscriptions, ['inscription_zh', 'inscription_en'] as const),
  coin_type_hierarchy: pick(coinTypeHierarchy, [
    'level1_zh', 'level1_en', 'level2_zh', 'level2_en', 'level3_zh', 'level3_en', 'level4_zh', 'level4_en', 'level5_zh', 'level5_en',
  ] as const),
}

export function selectCoinIssueEmbeds() {
  return db
    .select(COIN_ISSUE_EMBED)
    .from(coinIssues)
    .leftJoin(mints, eq(coinIssues.mint_id, mints.id))
    .leftJoin(states, eq(coinIssues.state_id, states.id))
    .leftJoin(inscriptions, eq(coinIssues.inscription_id, inscriptions.id))
    .leftJoin(coinTypeHierarchy, eq(coinIssues.coin_type_hierarchy_id, coinTypeHierarchy.id))
}

type LegacyTypeFields = {
  legacy_inscription?: string | null
  legacy_mint?: string | null
  legacy_state?: string | null
}

/** Some coin_issues rows have inscription/mint/state text recorded in the
 * legacy_* free-text columns but never matched to a row in the inscriptions/
 * mints/states lookup tables, so the FK-joined fields come back null. */
function applyLegacyText(issue: CoinIssueDisplay, legacy: LegacyTypeFields | null | undefined): CoinIssueDisplay {
  return {
    ...issue,
    inscription: issue.inscription ?? legacy?.legacy_inscription ?? null,
    mint_zh: issue.mint_zh ?? legacy?.legacy_mint ?? null,
    state_zh: issue.state_zh ?? legacy?.legacy_state ?? null,
  }
}

/** Flattens a joined coin_issues row into the same flat zh/en text shape the
 * old coin_types table provided, plus the FK ids for match-logic callers
 * (see lib/typology-filter.ts, lib/mint-filter.ts). A null
 * coin_type_hierarchy_id means the issue has no type — its major/minor/level2
 * fields stay null rather than being resolved from legacy_type. */
export function flattenCoinIssue(row: CoinIssueEmbed): CoinIssueDisplay {
  const cth = one(row.coin_type_hierarchy)
  const { major_zh, major_en, minor_zh, minor_en } = deriveMajorMinor(cth)
  const mint = one(row.mints)
  const state = one(row.states)
  const inscription = one(row.inscriptions)
  return applyLegacyText(
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
    row
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

function unionMapSiteTypeFields<T extends MapSite>(site: T, extra: MapSiteTypeFields): T {
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
 * coin_issues_id) get those columns rebuilt from finds → coin_issues →
 * hierarchy. */
async function fillMissingMapSiteTypes<T extends MapSite>(sites: T[]): Promise<T[]> {
  const missing = sites.filter((site) => (site.find_record_count ?? 0) > 0 && !siteHasTypeCsv(site))
  if (missing.length === 0) return sites

  const finds = await getFindsForSiteCodes(missing.map((site) => site.site_code))
  const issueIds = [...new Set(finds.map((find) => find.coin_issues_id).filter((id): id is string => !!id))]
  if (issueIds.length === 0) return sites

  const [issueRows, hierarchyRows] = await Promise.all([
    selectCoinIssueEmbeds().where(inArray(coinIssues.id, issueIds)).orderBy(asc(coinIssues.coin_type_code)) as Promise<
      CoinIssueEmbed[]
    >,
    getCoinTypeHierarchy(),
  ])
  const issueById = new Map(issueRows.map((row) => [row.id, flattenCoinIssue(row)]))
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
// Callers cast the result to their target row type (Site, Context, ...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenPeriod(row: any) {
  const { periods, ...rest } = row
  const period = one(periods as PeriodEmbed)
  return { ...rest, period_zh: period?.period_zh ?? null, period_en: period?.period_en ?? null }
}

function textIncludes(value: string | null | undefined, query: string): boolean {
  return !!value && value.toLowerCase().includes(query)
}

export async function getMapSites(): Promise<MapSite[]> {
  return db
    .select(MAP_SITE_FIELDS)
    .from(vCoinMapSites)
    .where(and(isNotNull(vCoinMapSites.lat), isNotNull(vCoinMapSites.lng)))
    .orderBy(asc(vCoinMapSites.site_code))
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

/** Sites tagged 不明单位 / county=不明 that may be missing from v_coin_map_sites.
 * Also carries description/period so /search's getAllSites() gets them for
 * these rows too (only a handful aren't already in the view). */
async function getPrecisionSupplementSites(): Promise<SearchSite[]> {
  const fields = {
    ...SITE_PRECISION_FIELDS,
    description_zh: sites.description_zh,
    description_en: sites.description_en,
    periods: PERIOD_EMBED,
  }
  const supplementQuery = () => db.select(fields).from(sites).leftJoin(periods, eq(sites.period_id, periods.id))
  const [nameTagged, countyTagged] = await Promise.all([
    supplementQuery().where(like(sites.site_name_zh, '%不明单位%')).orderBy(asc(sites.site_code)),
    supplementQuery().where(eq(sites.county_zh, '不明')).orderBy(asc(sites.site_code)),
  ])

  const byCode = new Map<string, SearchSite>()
  ;[...nameTagged, ...countyTagged].forEach((row) => {
    const { period_zh, period_en } = flattenPeriod(row)
    byCode.set(row.site_code, {
      ...siteRowToMapSite(row),
      period_zh,
      period_en,
      description_zh: row.description_zh,
      description_en: row.description_en,
    })
  })
  return [...byCode.values()]
}

function mergeMapSites<T extends MapSite>(base: T[], extras: T[]): T[] {
  const byCode = new Map<string, T>()
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

/**
 * Scoped counterpart to getFindSpotsMapSites -- `.in('site_code', ...)` on
 * v_coin_map_sites, falling back to plain `sites` (same precision-tagged
 * cases getPrecisionSupplementSites patches in) for any code the view
 * excludes, instead of paging the whole map-sites table plus its supplement
 * fetches just to find a handful of already-known sites. Deliberately skips
 * fillMissingMapSiteTypes -- that only backfills the type-CSV columns, which
 * a caller that already knows its exact site codes (e.g. the coin-type
 * detail page's Related Finds table, which only reads name/province/
 * quantity) never needs.
 */
export async function getMapSitesByCodes(siteCodes: string[]): Promise<MapSite[]> {
  if (siteCodes.length === 0) return []

  const data = await db.select(MAP_SITE_FIELDS).from(vCoinMapSites).where(inArray(vCoinMapSites.site_code, siteCodes))

  const found = new Set(data.map((s) => s.site_code))
  const missing = siteCodes.filter((code) => !found.has(code))
  if (missing.length === 0) return data

  const fallback = await db.select(SITE_PRECISION_FIELDS).from(sites).where(inArray(sites.site_code, missing))

  return [...data, ...fallback.map(siteRowToMapSite)]
}

export async function getAllSites(): Promise<SearchSite[]> {
  const [sites, supplements] = await Promise.all([
    db.select(SEARCH_SITE_FIELDS).from(vCoinMapSites).orderBy(asc(vCoinMapSites.site_name_zh)),
    getPrecisionSupplementSites(),
  ])
  return fillMissingMapSiteTypes(mergeMapSites(sites, supplements))
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  // totalCoins inlines the body of the sum_total_quantity_for_map() Postgres
  // function (scripts/add-sum-total-quantity-function.sql) rather than calling
  // it, so it carries over to a database without that function.
  const [[{ siteCount }], [{ findCount }], [{ totalCoins }]] = await Promise.all([
    db.select({ siteCount: count() }).from(vCoinMapSites),
    db.select({ findCount: count() }).from(finds),
    db
      .select({ totalCoins: sql<number>`coalesce(sum(${vCoinMapSites.total_quantity_for_map}), 0)`.mapWith(Number) })
      .from(vCoinMapSites),
  ])

  return { siteCount, findCount, totalCoins }
}

/** Wrapped in React's cache() so app/sites/[site_code]/page.tsx's
 * generateMetadata and the page component — both called for the same
 * request — share one fetch instead of two. */
export const getSite = cache(async function getSite(siteCode: string): Promise<Site | null> {
  // .limit(2) + length check mirrors supabase-js .maybeSingle(), which
  // errors rather than picking one if the code isn't unique.
  const rows = await db
    .select({ ...getTableColumns(sites), periods: PERIOD_EMBED })
    .from(sites)
    .leftJoin(periods, eq(sites.period_id, periods.id))
    .where(eq(sites.site_code, siteCode))
    .limit(2)

  return maybeSingle(rows.map(flattenPeriod))
})

/** Same contract as supabase-js .maybeSingle(): null for no rows, throw for
 * more than one. */
function maybeSingle<T>(rows: T[]): T | null {
  if (rows.length > 1) throw new Error('JSON object requested, multiple (or no) rows returned')
  return rows[0] ?? null
}

export async function getSiteMapSummary(siteCode: string): Promise<MapSite | null> {
  const rows = await db.select(MAP_SITE_FIELDS).from(vCoinMapSites).where(eq(vCoinMapSites.site_code, siteCode)).limit(2)
  return maybeSingle(rows)
}

export async function getSiteContexts(siteCode: string): Promise<Context[]> {
  const rows = await db
    .select({ ...getTableColumns(contexts), periods: PERIOD_EMBED })
    .from(contexts)
    .leftJoin(periods, eq(contexts.period_id, periods.id))
    .where(eq(contexts.site_code, siteCode))
    .orderBy(asc(contexts.context_code))

  return rows.map(flattenPeriod)
}

/** finds joined to their coin issue. COIN_ISSUE_EMBED is spread at the top
 * level (not nested under coin_issues) so each of its own embeds still nulls
 * out on a missed left join; regrouped into `coin_issues` by toFind. */
function selectFindsWithCoinIssues() {
  return db
    .select({ find: finds, ...COIN_ISSUE_EMBED })
    .from(finds)
    .leftJoin(coinIssues, eq(finds.coin_issues_id, coinIssues.id))
    .leftJoin(mints, eq(coinIssues.mint_id, mints.id))
    .leftJoin(states, eq(coinIssues.state_id, states.id))
    .leftJoin(inscriptions, eq(coinIssues.inscription_id, inscriptions.id))
    .leftJoin(coinTypeHierarchy, eq(coinIssues.coin_type_hierarchy_id, coinTypeHierarchy.id))
}

function toFind({ find, ...coinIssue }: Awaited<ReturnType<typeof selectFindsWithCoinIssues>>[number]): Find {
  return { ...find, coin_issues: coinIssue.id ? flattenCoinIssue(coinIssue as CoinIssueEmbed) : null }
}

export async function getSiteFinds(contextCodes: string[]): Promise<Find[]> {
  if (contextCodes.length === 0) return []

  const rows = await selectFindsWithCoinIssues()
    .where(inArray(finds.context_code, contextCodes))
    .orderBy(asc(finds.find_code))

  return rows.map(toFind)
}

/** One find by id, same shape as getSiteFinds — what a find edit hands back. */
export async function getFindById(id: string): Promise<Find | null> {
  const rows = await selectFindsWithCoinIssues().where(eq(finds.id, id)).limit(2)
  return maybeSingle(rows.map(toFind))
}

export async function getSources(sourceCodes: string[]): Promise<Source[]> {
  const codes = [...new Set(sourceCodes.flatMap((raw) => splitSourceCodes(raw)).filter(Boolean))]
  if (codes.length === 0) return []

  return db.select().from(sources).where(inArray(sources.source_code, codes)) as Promise<Source[]>
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
 * coinIssues are fetched once. A previous `searchSites()` helper re-fetched
 * both internally, which could push Vercel hobby's ~10s function limit and
 * make /search hang; it had no callers and was removed. */
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

/** Reads the flattened, pre-joined `v_coin_issues_flat` view (mints/states/
 * inscriptions/coin_type_hierarchy already joined and major/minor derived in
 * SQL) instead of embedding + flattenCoinIssue-ing coin_issues by hand — same
 * CoinIssueDisplay shape, no client-side join. A row with a null hierarchy FK
 * simply has no type. */
export async function getCoinIssues(): Promise<CoinIssueDisplay[]> {
  return db.select().from(vCoinIssuesFlat).orderBy(asc(vCoinIssuesFlat.coin_type_code))
}

/** Scoped counterpart to getCoinIssues -- `.in('coin_type_hierarchy_id', ...)`
 * on the same view, instead of paging the whole ~2,279-row catalog just to
 * find one coin-type node's own issues (the /coin-types/[type_code] Coin
 * Issues table, and its states/mints/inscriptions dedup lists). */
export async function getCoinIssuesByHierarchyIds(hierarchyIds: string[]): Promise<CoinIssueDisplay[]> {
  if (hierarchyIds.length === 0) return []
  return db
    .select()
    .from(vCoinIssuesFlat)
    .where(inArray(vCoinIssuesFlat.coin_type_hierarchy_id, hierarchyIds))
    .orderBy(asc(vCoinIssuesFlat.coin_type_code))
}

/** Scoped counterpart to getCoinIssues -- one mint's own issues (at most a
 * few dozen) instead of the whole catalog, for the /mints/[mint_code] page's
 * coin-type label links. */
export async function getCoinIssuesByMintId(mintId: string): Promise<CoinIssueDisplay[]> {
  return db
    .select()
    .from(vCoinIssuesFlat)
    .where(eq(vCoinIssuesFlat.mint_id, mintId))
    .orderBy(asc(vCoinIssuesFlat.coin_type_code))
}

export const COIN_TYPE_HIERARCHY_FIELDS = pick(coinTypeHierarchy, [
  'id', 'level1_zh', 'level1_en', 'level2_zh', 'level2_en', 'level3_zh', 'level3_en', 'level4_zh', 'level4_en',
  'level5_zh', 'level5_en', 'img_acc_num', 'description_zh', 'description_en', 'type_code',
] as const)

/** Wrapped in React's cache() so app/coin-types/[type_code]/page.tsx's
 * generateMetadata and the page component — both called for the same
 * request — share one fetch instead of two (same pattern as getSite). */
export const getCoinTypeHierarchy = cache(async function getCoinTypeHierarchy(): Promise<CoinTypeHierarchyRow[]> {
  return db.select(COIN_TYPE_HIERARCHY_FIELDS).from(coinTypeHierarchy).orderBy(asc(coinTypeHierarchy.level2_zh))
})

/** Single hierarchy row by its URL slug — same scoped `.eq(...).maybeSingle()`
 * pattern as getSite/getMintByCode, instead of paging every hierarchy row
 * just to find one via a recomputed-slug match. Wrapped in cache() so
 * generateMetadata and generateStaticParams' single-row needs (none today,
 * but future callers) share a fetch the same way getCoinTypeHierarchy does. */
export const getCoinTypeByCode = cache(async function getCoinTypeByCode(
  typeCode: string
): Promise<CoinTypeHierarchyRow | null> {
  const rows = await db
    .select(COIN_TYPE_HIERARCHY_FIELDS)
    .from(coinTypeHierarchy)
    .where(eq(coinTypeHierarchy.type_code, typeCode))
    .limit(2)
  return maybeSingle(rows)
})

// ── sources / source_links ──────────────────────────────────────────────

export async function getAllSources(): Promise<Source[]> {
  return db.select().from(sources).orderBy(asc(sources.source_code)) as Promise<Source[]>
}

export async function getAllSourceLinks(): Promise<SourceLink[]> {
  return db.select().from(sourceLinks).orderBy(asc(sourceLinks.source_code)) as Promise<SourceLink[]>
}

/**
 * source_links scoped to one site: its own site_code, its contexts'
 * context_codes, and its finds' find_codes. Deliberately excludes
 * coin_item-typed links (a site's finds have coin items too, but the
 * requirement scopes this to the site/context/find records themselves) —
 * three separate .eq/.in queries rather than one fragile OR-string, since
 * target_code isn't a real FK and the three code spaces don't overlap.
 */
// (A single context can carry 300+ finds — seen live: 385. That needed
// chunking when PostgREST serialized .in() into the request URL; as bound
// parameters it's nowhere near Postgres's 65,535-parameter limit.)
export async function getSourceLinksForSite(
  siteCode: string,
  contextCodes: string[],
  findCodes: string[]
): Promise<SourceLink[]> {
  async function linksForCodes(targetType: SourceLink['target_type'], codes: string[]): Promise<SourceLink[]> {
    if (codes.length === 0) return []
    return db
      .select()
      .from(sourceLinks)
      .where(and(eq(sourceLinks.target_type, targetType), inArray(sourceLinks.target_code, codes))) as Promise<
      SourceLink[]
    >
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
  return db
    .select()
    .from(sourceLinks)
    .where(and(eq(sourceLinks.target_type, 'mint'), eq(sourceLinks.target_code, mintCode))) as Promise<SourceLink[]>
}

export async function getStates(): Promise<State[]> {
  return db.select(pick(states, ['id', 'state_zh', 'state_en'] as const)).from(states).orderBy(asc(states.state_zh))
}

export async function getInscriptions(): Promise<Inscription[]> {
  return db
    .select(pick(inscriptions, ['id', 'inscription_zh', 'inscription_en'] as const))
    .from(inscriptions)
    .orderBy(asc(inscriptions.inscription_zh))
}

/** images + embedded `sources(citation_zh, citation_en, url)`. */
function selectImages() {
  return db
    .select({
      ...pick(images, [
        'id', 'filename', 'source_id', 'source_text', 'caption_zh', 'caption_en', 'note_zh', 'note_en',
      ] as const),
      sources: pick(sources, ['citation_zh', 'citation_en', 'url'] as const),
    })
    .from(images)
    .leftJoin(sources, eq(images.source_id, sources.id))
}

export async function getImages(): Promise<ImageRecord[]> {
  return selectImages().orderBy(asc(images.filename))
}

/** Same columns as getImages, scoped to specific ids (e.g. a single mint's
 * image_ids) instead of paging the whole images table. */
export async function getImagesByIds(ids: string[]): Promise<ImageRecord[]> {
  if (ids.length === 0) return []
  return selectImages().where(inArray(images.id, ids))
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

/** mints + embedded `states(state_zh, state_en)`. */
function selectMints() {
  return db
    .select({
      ...pick(mints, [
        'id', 'name_zh', 'name_en', 'precision_level', 'latitude', 'longitude', 'description_zh', 'description_en',
        'citation', 'modern_location_zh', 'modern_location_en', 'location_note', 'state_id',
      ] as const),
      states: pick(states, ['state_zh', 'state_en'] as const),
      ...pick(mints, ['image_ids', 'sources_unlinked', 'mint_code', 'alternative_names'] as const),
    })
    .from(mints)
    .leftJoin(states, eq(mints.state_id, states.id))
}

export async function getMints(): Promise<MintRow[]> {
  return selectMints().orderBy(asc(mints.name_zh)) as Promise<MintRow[]>
}

/** getMints, already flattened to MintInfo — the shape most page-level
 * callers actually want (name/state/coordinates), rather than the raw
 * `mints` row + nested `states` join. */
export async function getMintInfos(): Promise<MintInfo[]> {
  return (await getMints()).map(toMintInfo)
}

/** Single mint by its URL slug — same scoped `.eq(...).maybeSingle()` pattern
 * as getSite, instead of paging all `mints` rows just to find one via `.find()`. */
export async function getMintByCode(mintCode: string): Promise<MintRow | null> {
  const rows = await selectMints().where(eq(mints.mint_code, mintCode)).limit(2)
  return maybeSingle(rows) as MintRow | null
}

/** One row per mint from v_mint_stats (scripts/add-mint-stats-view.sql) —
 * the same find/coin/site counts and inscriptions computeMintStatsFromFinds
 * builds, plus the mint's catalogued issue count and bilingual coin-type
 * labels, all aggregated in Postgres instead of from the full `finds` and
 * `coin_issues` tables. type_labels is deduped by zh but unsorted. */
export type MintStatsRow = {
  mint_id: string
  mint_code: string
  find_count: number
  coin_count: number
  site_count: number
  inscriptions: string[]
  issue_count: number
  type_labels: MintTypeLabel[]
}

export async function getMintStats(): Promise<MintStatsRow[]> {
  return db.select().from(vMintStats).orderBy(asc(vMintStats.mint_code))
}

/** Minimal shape of a v_coin_finds row scoped to one coin-type node's
 * subtree -- just enough to compute a node's coin/site counts.
 * quantity_for_map is already coalesced server-side
 * (quantity_total ?? quantity_estimated ?? quantity_min ?? 1), same
 * convention v_coin_map_sites's total_quantity_for_map uses. */
export type CoinTypeFind = {
  site_code: string | null
  quantity_for_map: number
}

/** Scoped counterpart to getFindsForHeatmap -- v_coin_finds already joins
 * finds out to coin_type_hierarchy server-side (coin_type_id), so this can
 * scope directly by hierarchy id without first fetching coin_issues to
 * derive an issue-id list the way a raw `finds` query would need to. */
export async function getCoinFindsByHierarchyIds(hierarchyIds: string[]): Promise<CoinTypeFind[]> {
  if (hierarchyIds.length === 0) return []
  return db
    .select(pick(vCoinFinds, ['site_code', 'quantity_for_map'] as const))
    .from(vCoinFinds)
    .where(inArray(vCoinFinds.coin_type_id, hierarchyIds))
    .orderBy(asc(vCoinFinds.find_code))
}

export async function getFindsForHeatmap(): Promise<HeatmapFind[]> {
  // coin_issues_id lives directly on `finds` (the real FK to coin_issues.id)
  // -- no embed needed to read it, and nothing here should ever touch
  // coin_type_code, which finds.* no longer carries under that name at all
  // (renamed to deprecated_coin_type_code).
  const rows = await selectHeatmapFinds().orderBy(asc(finds.find_code))
  return rows.map(mapHeatmapFindRow)
}

/** finds inner-joined to their context's site_code — the old
 * `contexts!inner(site_code)` embed. */
function selectHeatmapFinds() {
  return db
    .select({
      ...pick(finds, [
        'coin_issues_id', 'context_code', 'quantity_total', 'quantity_min', 'quantity_estimated', 'presence',
      ] as const),
      contexts: { site_code: contexts.site_code },
    })
    .from(finds)
    .innerJoin(contexts, eq(finds.context_code, contexts.context_code))
}

/** Same shape as getFindsForHeatmap, but only finds whose context belongs to
 * one of `siteCodes` — used by /search so result-list pies don't force a
 * full finds table scan on every query. (Was a two-step contexts → finds
 * fetch to dodge PostgREST's slow nested `.in('contexts.site_code', …)`;
 * a plain SQL join doesn't have that problem.) */
export async function getFindsForSiteCodes(siteCodes: string[]): Promise<HeatmapFind[]> {
  if (siteCodes.length === 0) return []
  const unique = [...new Set(siteCodes.filter(Boolean))]

  try {
    const rows = await selectHeatmapFinds()
      .where(inArray(contexts.site_code, unique))
      .orderBy(asc(finds.find_code))
    return rows.map(mapHeatmapFindRow)
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

export function buildTypeKey(coin: {
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

export function buildTypeLabel(coin: {
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
  const mintedCoinTypes = await db
    .select(
      pick(vCoinIssuesFlat, [
        'id', 'coin_type_code', 'major_type_zh', 'major_type_en', 'minor_type_zh', 'minor_type_en', 'inscription',
        'inscription_en',
      ] as const)
    )
    .from(vCoinIssuesFlat)
    .where(eq(vCoinIssuesFlat.mint_id, mintId))

  if (mintedCoinTypes.length === 0) {
    return EMPTY_MINT_FINDSPOTS_DATA
  }

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

  const mintFinds = await db
    .select(
      pick(finds, [
        'find_code', 'context_code', 'coin_issues_id', 'quantity_total', 'quantity_estimated', 'quantity_min',
      ] as const)
    )
    .from(finds)
    .where(inArray(finds.coin_issues_id, coinIssueIds))
    .orderBy(asc(finds.find_code))
  if (mintFinds.length === 0) return { ...EMPTY_MINT_FINDSPOTS_DATA, inscriptions, typeLabels }

  const totalCoinCount = mintFinds.reduce((sum, f) => sum + findQuantity(f), 0)

  const contextCodes = [...new Set(mintFinds.map((f) => f.context_code).filter(Boolean))]
  const mintContexts = await db
    .select(pick(contexts, ['context_code', 'site_code'] as const))
    .from(contexts)
    .where(inArray(contexts.context_code, contextCodes))
    .orderBy(asc(contexts.context_code))

  const contextToSite = new Map<string, string>()
  mintContexts.forEach((ctx) => contextToSite.set(ctx.context_code, ctx.site_code))

  const siteCodeSet = new Set<string>()
  const siteTypeSetMap = new Map<string, Set<string>>()
  const typeKeyToLabel = new Map<string, string>()

  const idToTypeRow = new Map(
    mintedCoinTypes.map((row) => [row.id, row] as const)
  )

  mintFinds.forEach((find) => {
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

  const sites = await db
    .select(MAP_SITE_FIELDS)
    .from(vCoinMapSites)
    .where(
      and(
        inArray(vCoinMapSites.site_code, siteCodes),
        isNotNull(vCoinMapSites.lat),
        isNotNull(vCoinMapSites.lng)
      )
    )
    .orderBy(asc(vCoinMapSites.site_code))

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
