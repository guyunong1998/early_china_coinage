/**
 * Placeholder for the "this type is a mould, not a coin" tag. Nothing in the
 * data model distinguishes moulds yet (not lib/typology-data.ts, not the
 * coin_types table), so `isMould` has no real source to read from today —
 * this component exists so the card/detail-page layout already has the slot
 * wired in. Once a real field exists (e.g. after the Supabase migration),
 * pass it through here and the "M" tag starts appearing with no layout
 * changes needed.
 */
export function MouldTag({ isMould = false }: { isMould?: boolean }) {
  if (!isMould) return null
  return (
    <span
      title="Mould"
      className="shrink-0 rounded bg-gray-700 px-1.5 py-0.5 text-xs font-bold text-white"
    >
      M
    </span>
  )
}
