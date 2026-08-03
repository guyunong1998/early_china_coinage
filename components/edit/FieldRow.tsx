import type { ReactNode } from 'react'

/** Plain-label counterpart to components/ui/DetailRow.tsx (which requires an
 * i18n DictionaryKey) — used in admin display panels where labels are
 * dev-tool copy, not user-facing translated content. Same visual rhythm. */
export function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}

/** Shared text input style used by every admin edit form. */
export const fieldInputClass =
  'w-full rounded border border-brand/30 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand'

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-0.5 block text-xs font-semibold text-gray-600">{children}</label>
}
