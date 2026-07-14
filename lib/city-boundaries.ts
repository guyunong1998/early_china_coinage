import type { MapSite } from '@/lib/types'

type GeoJsonObject = {
  type: string
  coordinates?: unknown
  geometries?: unknown
}

const boundaryCache = new Map<string, GeoJsonObject | null>()

const UNKNOWN_TOKENS = ['未知', '不详', '无', '—', '-', 'n/a', 'na', 'unknown']

/** Mutually exclusive geolocation precision derived from site naming conventions. */
export type SitePrecisionLevel = 'site' | 'county' | 'city'

export type PrecisionFilter = 'all' | SitePrecisionLevel

export type PrecisionSiteFields = {
  site_name_zh: string | null
  county_zh: string | null
  city_zh?: string | null
  location_detail_zh?: string | null
}

export function isUnknownText(value: string | null | undefined) {
  if (!value) return true
  const v = value.trim().toLowerCase()
  if (!v) return true
  return UNKNOWN_TOKENS.includes(v)
}

/** County field is the placeholder 不明 → only city (or coarser) is known. */
export function isCountyUnknown(countyZh: string | null | undefined) {
  return (countyZh ?? '').trim() === '不明'
}

/** Site name contains 不明单位 → findspot only resolved to county, not a specific unit. */
export function isCountyLevelSiteName(siteNameZh: string | null | undefined) {
  return (siteNameZh ?? '').includes('不明单位')
}

/**
 * Exclusive precision bucket for a find spot:
 * - county: site name contains 「不明单位」(takes priority even when county_zh is 不明)
 * - city: county_zh is exactly 「不明」
 * - site: all other findspots (resolved to a specific unit/site)
 */
export function getSitePrecisionLevel(site: PrecisionSiteFields): SitePrecisionLevel {
  // Name rule first — user counts all 「不明单位」 rows as county-level (39 in sites table).
  if (isCountyLevelSiteName(site.site_name_zh)) return 'county'
  if (isCountyUnknown(site.county_zh)) return 'city'
  return 'site'
}

export function siteMatchesPrecisionFilter(
  site: PrecisionSiteFields,
  filter: PrecisionFilter
): boolean {
  if (filter === 'all') return true
  return getSitePrecisionLevel(site) === filter
}

export function parsePrecisionFilter(value: string | undefined | null): PrecisionFilter {
  if (value === 'site' || value === 'county' || value === 'city') return value
  // Legacy query params from earlier UI
  if (value === 'city_only') return 'city'
  if (value === 'county_only') return 'county'
  return 'all'
}

export function countSitesByPrecision(
  sites: PrecisionSiteFields[]
): Record<PrecisionFilter, number> {
  const counts: Record<PrecisionFilter, number> = {
    all: sites.length,
    site: 0,
    county: 0,
    city: 0,
  }
  sites.forEach((site) => {
    counts[getSitePrecisionLevel(site)] += 1
  })
  return counts
}

/** @deprecated Use getSitePrecisionLevel */
export function getSitePrecision(site: PrecisionSiteFields): SitePrecisionLevel {
  return getSitePrecisionLevel(site)
}

/** City-level precision: draw the city admin boundary. */
export function shouldShowCityBoundary(site: MapSite) {
  return getSitePrecisionLevel(site) === 'city' && !!site.city_zh?.trim()
}

/** County-level precision: draw the county admin boundary. */
export function shouldShowCountyBoundary(site: MapSite) {
  return getSitePrecisionLevel(site) === 'county' && !!site.county_zh?.trim() && !isCountyUnknown(site.county_zh)
}

function cacheKey(level: 'city' | 'county', nameZh: string, provinceZh?: string | null, cityZh?: string | null) {
  return `${level}::${provinceZh ?? ''}::${cityZh ?? ''}::${nameZh}`
}

async function fetchBoundaryGeoJson(key: string, queryParts: Array<string | null | undefined>) {
  if (boundaryCache.has(key)) return boundaryCache.get(key) ?? null

  const query = [...queryParts, 'China'].filter(Boolean).join(', ')
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}` +
    `&format=jsonv2&polygon_geojson=1&addressdetails=1&limit=5`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,en;q=0.8',
      },
    })
    if (!response.ok) {
      boundaryCache.set(key, null)
      return null
    }

    const results = (await response.json()) as Array<{ geojson?: GeoJsonObject }>
    const geoCandidates = (results ?? [])
      .map((item) => item.geojson)
      .filter((g): g is GeoJsonObject => g != null)
    const geo =
      geoCandidates.find((g) => g.type === 'Polygon' || g.type === 'MultiPolygon') ?? null
    boundaryCache.set(key, geo)
    return geo
  } catch {
    boundaryCache.set(key, null)
    return null
  }
}

export async function fetchCityBoundaryGeoJson(cityZh: string, provinceZh?: string | null) {
  const key = cacheKey('city', cityZh, provinceZh)
  return fetchBoundaryGeoJson(key, [cityZh, provinceZh])
}

export async function fetchCountyBoundaryGeoJson(
  countyZh: string,
  cityZh?: string | null,
  provinceZh?: string | null
) {
  const key = cacheKey('county', countyZh, provinceZh, cityZh)
  return fetchBoundaryGeoJson(key, [countyZh, cityZh, provinceZh])
}
