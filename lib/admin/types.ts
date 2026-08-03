/** Return shape every lib/admin/*-actions.ts mutation follows, consumed by
 * React 19's useActionState in components/edit/EditableSection.tsx and its
 * siblings. `data` on success carries the updated/created row back to the
 * client so the UI can flip back to display mode without a refetch. */
export type ActionState<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[] | undefined> }

export function initialActionState<T>(data: T): ActionState<T> {
  return { ok: true, data }
}
