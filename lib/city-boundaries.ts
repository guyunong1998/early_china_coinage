import type { MapSite } from '@/lib/types'

type GeoJsonObject = {
  type: string
  coordinates?: unknown
  geometries?: unknown
}

const boundaryCache = new Map<string, GeoJsonObject | null>()

const UNKNOWN_TOKENS = ['未知', '不详', '无', '—', '-', 'n/a', 'na', 'unknown']

export type PrecisionFilter = 'all' | 'city' | 'city_only' | 'county_only'

export function isUnknownText(value: string | null | undefined) {
  if (!value) return true
  const v = value.trim().toLowerCase()
  if (!v) return true
  return UNKNOWN_TOKENS.includes(v)
}

/**
 * Rule requested by user:
 * city known + county unknown + specific location unknown => show city boundary.
 */
export function shouldShowCityBoundary(site: MapSite) {
  return (
    !isUnknownText(site.city_zh) &&
    isUnknownText(site.county_zh) &&
    isUnknownText(site.location_detail_zh)
  )
}

/**
 * County known + specific location unknown => show county boundary.
 */
export function shouldShowCountyBoundary(site: MapSite) {
  return !isUnknownText(site.county_zh) && isUnknownText(site.location_detail_zh)
}

export function getSitePrecision(site: {
  city_zh: string | null
  county_zh: string | null
  location_detail_zh: string | null
}): PrecisionFilter {
  const cityKnown = !isUnknownText(site.city_zh)
  const countyKnown = !isUnknownText(site.county_zh)
  const detailKnown = !isUnknownText(site.location_detail_zh)

  if (cityKnown && !countyKnown) return 'city_only'
  if (countyKnown && !detailKnown) return 'county_only'
  if (cityKnown) return 'city'
  return 'all'
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

