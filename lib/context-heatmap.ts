import type { HeatmapFind } from '@/lib/types'

/** Find-spots map: filtering by coin type or by mint. */
export type FilterMode = 'type' | 'mint'
/** Find-spots map: individual colored points, a blended density mass, or —
 * "by mint" filter mode only — Compare, which colors by which selected mint
 * a point belongs to instead of match ratio (see ComparePoint in
 * components/map/MapVisCanvas.tsx). */
export type ViewMode = 'points' | 'density' | 'compare'

export type ContextHeatState =
  | { kind: 'absent' }
  | { kind: 'pure' }
  | { kind: 'ratio'; ratio: number; matchedQty: number; totalQty: number }
  | { kind: 'unquantified' }

export type SiteHeatState =
  | { kind: 'no-filter' }
  | { kind: 'no-data' }
  | { kind: 'pure' }
  | { kind: 'ratio'; ratio: number; matchedQty: number; totalQty: number; contextCount: number }
  | { kind: 'unquantified' }

function coalesceQuantity(find: HeatmapFind): number | null {
  if (find.quantity_total != null) return find.quantity_total
  if (find.quantity_estimated != null) return find.quantity_estimated
  if (find.quantity_min != null) return find.quantity_min
  return null
}

/** Heat state for one archaeological context under the selected coin-type set. */
export function computeContextHeatState(
  finds: HeatmapFind[],
  matchedCodes: Set<string>
): ContextHeatState {
  if (finds.length === 0) return { kind: 'absent' }

  const matched = finds.filter((f) => f.coin_type_code && matchedCodes.has(f.coin_type_code))
  if (matched.length === 0) return { kind: 'absent' }

  // Entire context is the selected type → solid red
  if (matched.length === finds.length) return { kind: 'pure' }

  let matchedQty = 0
  let totalQty = 0
  let matchedQuantified = 0
  let totalQuantified = 0

  finds.forEach((find) => {
    const qty = coalesceQuantity(find)
    if (qty == null) return
    totalQuantified += 1
    totalQty += qty
    if (find.coin_type_code && matchedCodes.has(find.coin_type_code)) {
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
 * Aggregate context heat states up to a site marker.
 * - no-data: no context contains the selected type
 * - pure: every context that has finds of any kind is 100% the selected type,
 *   or every context that contains the type is pure and there is no mixed context
 * - ratio: quantity-weighted share across contexts that can be counted
 * - unquantified: type is present but no context has a usable quantity ratio
 */
export function aggregateSiteHeatState(contextStates: ContextHeatState[]): SiteHeatState {
  const active = contextStates.filter((s) => s.kind !== 'absent')
  if (active.length === 0) return { kind: 'no-data' }

  const pure = active.filter((s) => s.kind === 'pure')
  const ratios = active.filter((s): s is Extract<ContextHeatState, { kind: 'ratio' }> => s.kind === 'ratio')
  const unquantified = active.filter((s) => s.kind === 'unquantified')

  if (pure.length === active.length) return { kind: 'pure' }

  if (ratios.length > 0 || pure.length > 0) {
    let matchedQty = 0
    let totalQty = 0

    ratios.forEach((s) => {
      matchedQty += s.matchedQty
      totalQty += s.totalQty
    })
    // Pure contexts with unknown qty still pull the site toward red:
    // treat each as a full match unit when no quantities exist there.
    // If a pure context later gets quantities via ratio path it won't be in `pure`.
    if (totalQty > 0) {
      // Pure contexts without separate qty don't add to denominator; ratio contexts dominate.
      const ratio = Math.min(1, matchedQty / totalQty)
      // If some contexts are pure (100%) and others mixed, blend by counting pure
      // as contributing their share: approximate by weighting pure contexts equally
      // with the quantity mass when we lack their counts.
      if (pure.length > 0) {
        const blended =
          (ratio * ratios.length + 1 * pure.length) / (ratios.length + pure.length)
        return {
          kind: 'ratio',
          ratio: blended,
          matchedQty,
          totalQty,
          contextCount: active.length,
        }
      }
      return {
        kind: 'ratio',
        ratio,
        matchedQty,
        totalQty,
        contextCount: active.length,
      }
    }

    // Only pure + unquantified, no countable mixed contexts
    if (pure.length > 0 && unquantified.length === 0) return { kind: 'pure' }
    if (pure.length > 0) {
      return {
        kind: 'ratio',
        ratio: pure.length / active.length,
        matchedQty: pure.length,
        totalQty: active.length,
        contextCount: active.length,
      }
    }
  }

  return { kind: 'unquantified' }
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
  matchedCodes: Set<string> | null
): Map<string, SiteHeatState> | null {
  if (!matchedCodes) return null

  const bySite = groupFindsBySiteContext(finds)
  const result = new Map<string, SiteHeatState>()

  siteCodes.forEach((siteCode) => {
    const contexts = bySite.get(siteCode)
    if (!contexts || contexts.size === 0) {
      result.set(siteCode, { kind: 'no-data' })
      return
    }
    const contextStates = [...contexts.values()].map((ctxFinds) =>
      computeContextHeatState(ctxFinds, matchedCodes)
    )
    result.set(siteCode, aggregateSiteHeatState(contextStates))
  })

  return result
}
