/** Minimal shape every quantity helper below needs — HeatmapFind and other
 * find shapes across the app satisfy this structurally, including narrower
 * ad-hoc query results that don't select `presence`. */
type QuantityFields = {
  quantity_total: number | null
  quantity_estimated: number | null
  quantity_min: number | null
  presence?: boolean | null
}

/** A find's explicit recorded quantity — quantity_total, else
 * quantity_estimated, else quantity_min — or null when none of the three is
 * recorded. Deliberately ignores `presence`, which isn't a real count: null
 * here means "not quantified," distinct from a genuine zero. */
export function rawQuantity(find: QuantityFields): number | null {
  if (find.quantity_total != null) return find.quantity_total
  if (find.quantity_estimated != null) return find.quantity_estimated
  if (find.quantity_min != null) return find.quantity_min
  return null
}

/** rawQuantity, defaulting to 0 when nothing is recorded (or, when
 * `includePresence` is set, to 1 if the find is at least known to be
 * present) — for callers that need a definite number to sum rather than to
 * detect whether a find is quantified at all (see rawQuantity itself, or
 * findHasUsableQuantity in lib/context-heatmap.ts, for that). */
export function findQuantity(find: QuantityFields, options?: { includePresence?: boolean }): number {
  const qty = rawQuantity(find)
  if (qty != null) return qty
  return options?.includePresence && find.presence ? 1 : 0
}
