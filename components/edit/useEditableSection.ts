'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { ActionState } from '@/lib/admin/types'

/** How long a successful save's "Saved." confirmation stays visible before
 * the section collapses back to its read-only display -- long enough to
 * actually read, short enough not to feel stuck. */
const SAVED_CONFIRMATION_MS = 900

/**
 * Headless edit-in-place state machine, shared by every editable panel/card/
 * row in this feature. Layout-agnostic on purpose — table rows (FindRow,
 * CoinIssueRow) need a `<tr>`/`<td>` shape a generic wrapper component can't
 * safely produce, so this hook exposes raw state/handlers and each call site
 * builds its own DOM. components/edit/EditableSection.tsx wraps this for the
 * common (non-table) panel/card case.
 */
export function useEditableSection<T>({
  data,
  action,
  deleteAction,
  onDeleted,
  startInEditing = false,
}: {
  data: T
  action: (prev: ActionState<T>, formData: FormData) => Promise<ActionState<T>>
  deleteAction?: () => Promise<ActionState<T>>
  onDeleted?: () => void
  startInEditing?: boolean
}) {
  const [editing, setEditing] = useState(startInEditing)
  const [current, setCurrent] = useState(data)
  const [deletePending, setDeletePending] = useState(false)
  // True from the moment a save succeeds until the section actually closes
  // back to display mode -- keeps the success banner (ActionFormStatus) and
  // the disabled form on screen for a beat, instead of collapsing to the
  // read-only view in the same instant "Saved." would have appeared.
  const [justSaved, setJustSaved] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const [state, formAction, pending] = useActionState<ActionState<T>, FormData>(async (_prev, formData) => {
    const result = await action(_prev, formData)
    if (result.ok) {
      setCurrent(result.data)
      setJustSaved(true)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => {
        setEditing(false)
        setJustSaved(false)
      }, SAVED_CONFIRMATION_MS)
    }
    return result
  }, { ok: true, data })

  async function handleDelete() {
    if (!deleteAction) return
    setDeletePending(true)
    const result = await deleteAction()
    setDeletePending(false)
    if (result.ok) onDeleted?.()
  }

  return {
    editing,
    current,
    state,
    formAction,
    pending,
    /** True while the request is in flight, and for a beat after a
     * successful save while the confirmation is showing -- the form's
     * fields and buttons should stay disabled the whole time. */
    locked: pending || justSaved,
    deletePending,
    startEdit: () => setEditing(true),
    cancelEdit: () => setEditing(false),
    handleDelete: deleteAction ? handleDelete : undefined,
  }
}
