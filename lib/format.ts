export function displayValue(value: string | number | null | undefined, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
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

/** Lowercases, strips to [a-z0-9-], collapses to single dashes — for URL
 * slugs derived from a (usually English) label. `fallback` covers labels
 * that reduce to nothing (e.g. an all-CJK string with no romanization). */
export function slugify(label: string, fallback: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  )
}
