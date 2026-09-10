import type { ActionState } from '@/lib/admin/types'

/** Top-level error/success banner for a useActionState-driven form — shared
 * so it isn't hand-copied into every *EditForm component. */
export function ActionFormStatus<T>({ state }: { state: ActionState<T> }) {
  if (state.ok) {
    if (!state.message) return null
    return (
      <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        {state.message}
      </p>
    )
  }

  // A Zod failure (e.g. a required field the form doesn't render, so it's
  // never even sent) only ever sets fieldErrors, not formError -- without
  // this fallback that failure is completely silent: the form just stays
  // open with no explanation, which reads as "editing is broken" rather
  // than a fixable, visible error.
  const fieldMessages = state.fieldErrors
    ? Object.entries(state.fieldErrors)
        .filter((entry): entry is [string, string[]] => !!entry[1]?.length)
        .map(([name, messages]) => `${name}: ${messages[0]}`)
    : []
  const text = state.formError ?? (fieldMessages.length > 0 ? `Couldn't save — ${fieldMessages.join('; ')}` : null)
  if (!text) return null
  return (
    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{text}</p>
  )
}
