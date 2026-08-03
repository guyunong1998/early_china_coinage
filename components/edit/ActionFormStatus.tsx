import type { ActionState } from '@/lib/admin/types'

/** Top-level error/success banner for a useActionState-driven form — shared
 * so it isn't hand-copied into every *EditForm component. */
export function ActionFormStatus<T>({ state }: { state: ActionState<T> }) {
  if (state.ok) {
    if (!state.message) return null
    return <p className="text-sm font-medium text-emerald-700">{state.message}</p>
  }
  if (!state.formError) return null
  return <p className="text-sm font-medium text-red-600">{state.formError}</p>
}

/** Inline field-level error, rendered under a single input. */
export function FieldError<T>({ state, name }: { state: ActionState<T>; name: string }) {
  if (state.ok) return null
  const message = state.fieldErrors?.[name]?.[0]
  if (!message) return null
  return <p className="mt-0.5 text-xs text-red-600">{message}</p>
}
