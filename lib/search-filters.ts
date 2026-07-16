import {
  isUnknownText,
  siteMatchesPrecisionFilter,
  type PrecisionFilter,
} from '@/lib/city-boundaries'
import { splitCsv } from '@/lib/format'
import type { SearchSite } from '@/lib/queries'

export type { PrecisionFilter } from '@/lib/city-boundaries'

/** 'any' = site matches if it has at least one selected value (OR); 'all' = must have every selected value (AND). */
export type FacetMode = 'any' | 'all'

export type FilterState = {
  precision: PrecisionFilter
  mints: string[]
  mintsMode: FacetMode
  coinTypes: string[]
  coinTypesMode: FacetMode
  states: string[]
  statesMode: FacetMode
  regions: string[]
  periods: string[]
  siteTypes: string[]
  minQty: number | null
  maxQty: number | null
  onlySingle: boolean
  excludeSingle: boolean
}

export type SortOption = 'name' | 'quantity' | 'province' | 'finds' | 'coinTypes' | 'states'

const SORT_OPTIONS: SortOption[] = ['name', 'quantity', 'province', 'finds', 'coinTypes', 'states']

export function parseFacetMode(value: string | undefined): FacetMode {
  return value === 'all' ? 'all' : 'any'
}

export function parseSortOption(value: string | undefined): SortOption {
  return (SORT_OPTIONS as string[]).includes(value ?? '') ? (value as SortOption) : 'name'
}

export function sortSites<
  T extends Pick<
    SearchSite,
    'site_name_zh' | 'province_zh' | 'total_quantity_for_map' | 'find_record_count' | 'major_types_zh' | 'states_zh'
  >,
>(sites: T[], sort: SortOption): T[] {
  const sorted = [...sites]
  switch (sort) {
    case 'quantity':
      sorted.sort((a, b) => (b.total_quantity_for_map ?? 0) - (a.total_quantity_for_map ?? 0))
      break
    case 'finds':
      sorted.sort((a, b) => (b.find_record_count ?? 0) - (a.find_record_count ?? 0))
      break
    case 'coinTypes':
      sorted.sort((a, b) => splitCsv(b.major_types_zh).length - splitCsv(a.major_types_zh).length)
      break
    case 'states':
      sorted.sort((a, b) => splitCsv(b.states_zh).length - splitCsv(a.states_zh).length)
      break
    case 'province':
      sorted.sort((a, b) => (a.province_zh ?? '').localeCompare(b.province_zh ?? '', 'zh'))
      break
    case 'name':
    default:
      sorted.sort((a, b) => (a.site_name_zh ?? '').localeCompare(b.site_name_zh ?? '', 'zh'))
  }
  return sorted
}

export type FacetCategory =
  | 'precision'
  | 'mint'
  | 'coinType'
  | 'state'
  | 'region'
  | 'period'
  | 'siteType'
  | 'quantity'
  | 'singleFind'

/**
 * A site's province is always a candidate ("province"), and if its city is
 * also known it additionally gets the more specific "province · city" — so
 * the bare-province count naturally sums up every city under it.
 */
export function getRegionLabels(site: Pick<SearchSite, 'province_zh' | 'city_zh'>): string[] {
  if (isUnknownText(site.province_zh)) return []
  const labels = [site.province_zh as string]
  if (!isUnknownText(site.city_zh)) labels.push(`${site.province_zh} · ${site.city_zh}`)
  return labels
}

/** Coin type / subtype / inscription are merged into one facet, so a checked
 * value can come from any of the three granularities — check all of them. */
export function siteCoinTypeValues(site: SearchSite): string[] {
  return [...splitCsv(site.major_types_zh), ...splitCsv(site.minor_types_zh), ...splitCsv(site.inscriptions)]
}

/** 'any' = at least one selected value present (OR); 'all' = every selected value present (AND). */
function matchesFacet(values: string[], selected: string[], mode: FacetMode): boolean {
  if (selected.length === 0) return true
  return mode === 'all' ? selected.every((v) => values.includes(v)) : selected.some((v) => values.includes(v))
}

export function siteMatchesFilters(site: SearchSite, f: FilterState, skip?: FacetCategory): boolean {
  if (skip !== 'precision') {
    if (!siteMatchesPrecisionFilter(site, f.precision)) return false
  }

  if (skip !== 'mint' && !matchesFacet(splitCsv(site.mints_zh), f.mints, f.mintsMode)) return false
  if (skip !== 'coinType' && !matchesFacet(siteCoinTypeValues(site), f.coinTypes, f.coinTypesMode)) return false
  if (skip !== 'state' && !matchesFacet(splitCsv(site.states_zh), f.states, f.statesMode)) return false
  if (skip !== 'region' && f.regions.length > 0) {
    const labels = getRegionLabels(site)
    if (!f.regions.some((r) => labels.includes(r))) return false
  }
  if (skip !== 'period' && f.periods.length > 0) {
    if (!site.period_zh || !f.periods.includes(site.period_zh)) return false
  }
  if (skip !== 'siteType' && f.siteTypes.length > 0) {
    if (!site.site_type_zh || !f.siteTypes.includes(site.site_type_zh)) return false
  }

  if (skip !== 'quantity') {
    const qty = site.total_quantity_for_map ?? 0
    if (f.minQty !== null && qty < f.minQty) return false
    if (f.maxQty !== null && qty > f.maxQty) return false
  }

  if (skip !== 'singleFind') {
    const isSingle = (site.find_record_count ?? 0) === 1
    if (f.onlySingle && !isSingle) return false
    if (f.excludeSingle && isSingle) return false
  }

  return true
}

export type FacetOption = { value: string; count: number; en?: string | null }

/** Attaches an English gloss to each option's value, when known, so filter
 * items can always show both languages regardless of the UI language toggle. */
export function withEnglish(options: FacetOption[], lookup: Map<string, string>): FacetOption[] {
  return options.map((opt) => ({ ...opt, en: lookup.get(opt.value) ?? null }))
}

/**
 * Counts are computed against the result set with every *other* facet applied
 * (but not this one), so checking a box narrows other facets' counts without
 * making its own options disappear. Zero-count options are dropped, except
 * ones the user already has selected (so a selection never vanishes).
 *
 * Selected options are always sorted to the top of the list (as their own
 * group, in the usual count/alpha order), so a checked box stays visible
 * without having to scroll back to find it.
 */
export function buildFacetOptions(
  sites: SearchSite[],
  filters: FilterState,
  category: FacetCategory,
  getValues: (site: SearchSite) => string[],
  selected: string[]
): FacetOption[] {
  const scoped = sites.filter((s) => siteMatchesFilters(s, filters, category))
  const counts = new Map<string, number>()
  scoped.forEach((s) => {
    getValues(s).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1))
  })
  selected.forEach((v) => {
    if (!counts.has(v)) counts.set(v, 0)
  })

  return [...counts.entries()]
    .filter(([value, count]) => count > 0 || selected.includes(value))
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const aSelected = selected.includes(a.value)
      const bSelected = selected.includes(b.value)
      if (aSelected !== bSelected) return aSelected ? -1 : 1
      return b.count - a.count || a.value.localeCompare(b.value)
    })
}
