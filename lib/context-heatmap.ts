import type { HeatmapFind } from '@/lib/types'

/** Find-spots map: filtering by coin type or by mint. */
export type FilterMode = 'type' | 'mint'
/** Find-spots map: individual colored points, a blended density mass, or —
 * "by mint" filter mode only — Compare, which colors by which selected mint
 * a point belongs to instead of match ratio (see ComparePoint in
 * components/map/MapVisCanvas.tsx). */
export type ViewMode = 'points' | 'density' | 'compare'

// `totalQty` on 'absent'/'pure' is null when this context's finds aren't
// fully quantified — the site-level rollup below needs it to know whether
// its own totalQty is trustworthy (see aggregateSiteHeatState).
export type ContextHeatState =
  | { kind: 'absent'; totalQty: number | null }
  | { kind: 'pure'; totalQty: number | null }
  | { kind: 'ratio'; ratio: number; matchedQty: number; totalQty: number }
  | { kind: 'unquantified' }

export type SiteHeatState =
  | { kind: 'no-filter' }
  | { kind: 'no-data' }
  | { kind: 'pure' }
  | {
      kind: 'ratio'
      ratio: number
      matchedQty: number
      totalQty: number
      contextCount: number
      /** Mint Town only: find-record count matching the active filter, so
       * circle size can follow the selected type's own finds rather than the
       * mint's overall findCount. */
      matchedFindCount?: number
    }
  | { kind: 'unquantified' }

function coalesceQuantity(find: HeatmapFind): number | null {
  if (find.quantity_total != null) return find.quantity_total
  if (find.quantity_estimated != null) return find.quantity_estimated
  if (find.quantity_min != null) return find.quantity_min
  return null
}

/** Sum of every find's quantity, or null if any find in the list lacks a
 * usable quantity (in which case the sum can't be trusted as a total). */
function sumQuantityIfComplete(finds: HeatmapFind[]): number | null {
  let total = 0
  for (const find of finds) {
    const qty = coalesceQuantity(find)
    if (qty == null) return null
    total += qty
  }
  return total
}

/** Heat state for one archaeological context under the selected coin-issue set.
 * `matchedIds` are coin_issues.id values (see HeatmapFind.coin_issues_id) —
 * never coin_type_code, which finds no longer carries. */
export function computeContextHeatState(
  finds: HeatmapFind[],
  matchedIds: Set<string>
): ContextHeatState {
  if (finds.length === 0) return { kind: 'absent', totalQty: null }

  const matched = finds.filter((f) => f.coin_issues_id && matchedIds.has(f.coin_issues_id))
  // No match here — still carries this context's quantity (when countable)
  // so the site-level rollup can count it in the denominator instead of
  // dropping it, which used to make a site with e.g. one small pure-match
  // context and many unrelated contexts read as 100% matched.
  if (matched.length === 0) return { kind: 'absent', totalQty: sumQuantityIfComplete(finds) }

  // Entire context is the selected type → solid red
  if (matched.length === finds.length) return { kind: 'pure', totalQty: sumQuantityIfComplete(finds) }

  let matchedQty = 0
  let totalQty = 0
  let matchedQuantified = 0
  let totalQuantified = 0

  finds.forEach((find) => {
    const qty = coalesceQuantity(find)
    if (qty == null) return
    totalQuantified += 1
    totalQty += qty
    if (find.coin_issues_id && matchedIds.has(find.coin_issues_id)) {
      matchedQuantified += 1
      matchedQty += qty
    }
  })

  // Need countable totals for both matched and other types in the context
  if (totalQuantified === finds.length && totalQty > 0) {
    return {
      kind: 'ratio',
      ratio: Math.min(1, matchedQty / totalQty),
      matchedQty,
      totalQty,
    }
  }

  // Present in the context but quantities are incomplete → gray translucent
  return { kind: 'unquantified' }
}

/**
 * Aggregate context heat states up to a site marker. The ratio is a true
 * quantity-weighted share across the *whole site* — every context counts
 * toward the denominator, including ones where the selected type is entirely
 * absent, not just the contexts that contain a match. (Excluding
 * non-matching contexts from the denominator used to make a site with a
 * single small pure-match context, plus many unrelated contexts, read as
 * 100% matched — e.g. a site with one coin-mould find among hundreds of
 * ordinary coins used to show up as 100% coin moulds.)
 * - no-data: no context contains the selected type
 * - pure: every find at the site (across every context) matches
 * - ratio: quantity-weighted share across the site's contexts, when every
 *   context's quantity is countable
 * - unquantified: type is present, but at least one context (matching or
 *   not) lacks a usable quantity, so no trustworthy site-wide share exists
 */
export function aggregateSiteHeatState(contextStates: ContextHeatState[]): SiteHeatState {
  if (contextStates.length === 0) return { kind: 'no-data' }

  const matchedContextCount = contextStates.filter((s) => s.kind === 'pure' || s.kind === 'ratio').length
  if (matchedContextCount === 0) return { kind: 'no-data' }

  let matchedQty = 0
  let totalQty = 0
  let fullyQuantified = true

  for (const s of contextStates) {
    switch (s.kind) {
      case 'absent':
        if (s.totalQty == null) fullyQuantified = false
        else totalQty += s.totalQty
        break
      case 'pure':
        if (s.totalQty == null) fullyQuantified = false
        else {
          matchedQty += s.totalQty
          totalQty += s.totalQty
        }
        break
      case 'ratio':
        matchedQty += s.matchedQty
        totalQty += s.totalQty
        break
      case 'unquantified':
        fullyQuantified = false
        break
    }
  }

  if (!fullyQuantified || totalQty <= 0) return { kind: 'unquantified' }
  if (matchedQty >= totalQty) return { kind: 'pure' }
  return {
    kind: 'ratio',
    ratio: Math.min(1, matchedQty / totalQty),
    matchedQty,
    totalQty,
    contextCount: matchedContextCount,
  }
}

export function groupFindsBySiteContext(finds: HeatmapFind[]): Map<string, Map<string, HeatmapFind[]>> {
  const bySite = new Map<string, Map<string, HeatmapFind[]>>()
  finds.forEach((find) => {
    if (!find.site_code) return
    const contextKey = find.context_code || '__unknown__'
    if (!bySite.has(find.site_code)) bySite.set(find.site_code, new Map())
    const byContext = bySite.get(find.site_code)!
    if (!byContext.has(contextKey)) byContext.set(contextKey, [])
    byContext.get(contextKey)!.push(find)
  })
  return bySite
}

export function computeSiteHeatStates(
  siteCodes: string[],
  finds: HeatmapFind[],
  matchedIds: Set<string> | null
): Map<string, SiteHeatState> | null {
  if (!matchedIds) return null

  const bySite = groupFindsBySiteContext(finds)
  const result = new Map<string, SiteHeatState>()

  siteCodes.forEach((siteCode) => {
    const contexts = bySite.get(siteCode)
    if (!contexts || contexts.size === 0) {
      result.set(siteCode, { kind: 'no-data' })
      return
    }
    const contextStates = [...contexts.values()].map((ctxFinds) =>
      computeContextHeatState(ctxFinds, matchedIds)
    )
    result.set(siteCode, aggregateSiteHeatState(contextStates))
  })

  return result
}
