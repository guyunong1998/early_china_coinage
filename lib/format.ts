export function displayValue(value: string | number | null | undefined, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

export function formatLocation(site: {
  province_zh?: string | null
  city_zh?: string | null
  county_zh?: string | null
}) {
  return [site.province_zh, site.city_zh, site.county_zh].filter(Boolean).join(' · ')
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US')
}

export function formatCoordinates(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return '—'
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

export function splitCsv(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
