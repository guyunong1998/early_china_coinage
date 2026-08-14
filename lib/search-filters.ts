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
  inscriptions: string[]
  inscriptionsMode: FacetMode
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

export type SortOption = 'interest' | 'name' | 'quantity' | 'province' | 'finds' | 'coinTypes' | 'mints' | 'states'

const SORT_OPTIONS: SortOption[] = ['interest', 'name', 'quantity', 'province', 'finds', 'coinTypes', 'mints', 'states']

export function parseFacetMode(value: string | undefined): FacetMode {
  return value === 'all' ? 'all' : 'any'
}

// 'interest' reads best as the default — it's the one sort that rewards a
// site for being broadly notable (many finds, spanning many states/types/
// mints) rather than for a single dimension, so it's what most people
// scanning the list actually want to see first.
export function parseSortOption(value: string | undefined): SortOption {
  return (SORT_OPTIONS as string[]).includes(value ?? '') ? (value as SortOption) : 'interest'
}

function coinTypeCount(
  s: Pick<SearchSite, 'level1_types_zh' | 'level2_types_zh' | 'level3_types_zh' | 'level4_types_zh' | 'level5_types_zh'>
) {
  return (
    splitCsv(s.level1_types_zh).length +
    splitCsv(s.level2_types_zh).length +
    splitCsv(s.level3_types_zh).length +
    splitCsv(s.level4_types_zh).length +
    splitCsv(s.level5_types_zh).length
  )
}

function hasText(...values: (string | null | undefined)[]) {
  return values.some((v) => !!v?.trim())
}

/** How filled-out a site's own record is, independent of how many coins or
 * finds it has — a site with a written description is more useful to land
 * on than a bare set of fields. Deliberately left on its own 0–1 scale
 * rather than normalized to 0–10 like the other four factors (see
 * normalize() below) — it's a single concrete yes/no fact, not an
 * open-ended count that needs compressing. */
function completenessScore(s: Pick<SearchSite, 'description_zh' | 'description_en'>) {
  return hasText(s.description_zh, s.description_en) ? 1 : 0
}

/** Scales a raw count onto a fixed 0–1 range on a log curve, so factors
 * with very different natural scales (a handful of states vs. dozens of
 * finds) don't let the biggest-magnitude one dominate the interest sum,
 * and so the long tail of count-like data (most sites low, a few very
 * high — see the distribution notes above INTEREST_CAPS) doesn't crowd
 * every typical site into a narrow sliver near 0 the way a linear scale
 * would. log1p(x) = log(1+x), so a count of 0 still maps to 0. `cap` is
 * the value that reaches 1; anything at or above it clamps to 1 rather
 * than exceeding the scale — outliers past the cap still tie at the top,
 * same as they would under any bounded scale, log or linear. */
function normalize(value: number, cap: number) {
  return Math.min(Math.log1p(value) / Math.log1p(cap), 1)
}

// Caps chosen from the live data's actual distribution (checked directly
// against Supabase) so a "1" means "genuinely near the top for this
// measure", not an arbitrary round number:
//   finds:      p95 ≈ 16, p99 ≈ 50, max = 385  → cap 20
//   states:     max = 5                        → cap 5 (uses the full range)
//   coin types: p95 ≈ 7,  p99 ≈ 10, max = 18    → cap 10
//   mints:      p95 ≈ 7,  p99 ≈ 24, max = 63    → cap 10
// A handful of extreme outliers (385 finds, 63 mints) clamp at 1 rather
// than compressing everyone else toward 0.
const INTEREST_CAPS = { finds: 20, states: 5, coinTypes: 10, mints: 10 }

// Each factor's weight in the interest sum — equal by default, so no
// dimension is deliberately favored over another. Adjust these to shift
// emphasis (e.g. raise coinTypes to foreground numismatic diversity over
// raw find volume).
const INTEREST_COEFFICIENTS = { finds: 1, states: 1, coinTypes: 4, mints: 2, completeness: 2 }

export function sortSites<
  T extends Pick<
    SearchSite,
    | 'site_name_zh'
    | 'province_zh'
    | 'total_quantity_for_map'
    | 'find_record_count'
    | 'level1_types_zh'
    | 'level2_types_zh'
    | 'level3_types_zh'
    | 'level4_types_zh'
    | 'level5_types_zh'
    | 'states_zh'
    | 'mints_zh'
    | 'description_zh'
    | 'description_en'
  >,
>(sites: T[], sort: SortOption): T[] {
  const sorted = [...sites]
  switch (sort) {
    case 'interest': {
      // interest = Σ coefficient × normalize(rawCount, cap), for finds/
      // states/coinTypes/mints (each log-scaled to 0–1 — see normalize()
      // and INTEREST_CAPS above), plus coefficient × completeness (has a
      // description or not, already a native 0–1 fact). Coefficients
      // (INTEREST_COEFFICIENTS above) weight each factor's contribution —
      // a site that's genuinely broad across every dimension, and has a
      // description, naturally floats to the top. Same explanation shown
      // to users via search.sortHint.interest.
      //
      // A site with exactly one coin total is the least interesting case
      // by definition, regardless of how the other factors happen to
      // land (e.g. it could still have a description) — sink it below
      // every other score instead of letting it land in the middle.
      const score = (s: T) => {
        if (s.total_quantity_for_map === 1) return -Infinity
        return (
          INTEREST_COEFFICIENTS.finds * normalize(s.find_record_count ?? 0, INTEREST_CAPS.finds) +
          INTEREST_COEFFICIENTS.states * normalize(splitCsv(s.states_zh).length, INTEREST_CAPS.states) +
          INTEREST_COEFFICIENTS.coinTypes * normalize(coinTypeCount(s), INTEREST_CAPS.coinTypes) +
          INTEREST_COEFFICIENTS.mints * normalize(splitCsv(s.mints_zh).length, INTEREST_CAPS.mints) +
          INTEREST_COEFFICIENTS.completeness * completenessScore(s)
        )
      }
      sorted.sort((a, b) => score(b) - score(a))
      break
    }
    case 'quantity':
      sorted.sort((a, b) => (b.total_quantity_for_map ?? 0) - (a.total_quantity_for_map ?? 0))
      break
    case 'finds':
      sorted.sort((a, b) => (b.find_record_count ?? 0) - (a.find_record_count ?? 0))
      break
    case 'coinTypes':
      sorted.sort((a, b) => coinTypeCount(b) - coinTypeCount(a))
      break
    case 'mints':
      sorted.sort((a, b) => splitCsv(b.mints_zh).length - splitCsv(a.mints_zh).length)
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
  | 'inscription'
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

/** All five typology levels are merged into one facet, so a checked value
 * can come from any granularity — check all of them. Inscription is its own
 * separate facet (siteInscriptionValues below), not merged in here. */
export function siteCoinTypeValues(site: SearchSite): string[] {
  return [
    ...splitCsv(site.level1_types_zh),
    ...splitCsv(site.level2_types_zh),
    ...splitCsv(site.level3_types_zh),
    ...splitCsv(site.level4_types_zh),
    ...splitCsv(site.level5_types_zh),
  ]
}

export function siteInscriptionValues(site: SearchSite): string[] {
  return splitCsv(site.inscriptions)
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
  if (skip !== 'inscription' && !matchesFacet(siteInscriptionValues(site), f.inscriptions, f.inscriptionsMode))
    return false
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
