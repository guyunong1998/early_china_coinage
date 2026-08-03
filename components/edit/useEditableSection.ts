'use client'

import { useActionState, useState } from 'react'
import type { ActionState } from '@/lib/admin/types'

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

  const [state, formAction, pending] = useActionState<ActionState<T>, FormData>(async (_prev, formData) => {
    const result = await action(_prev, formData)
    if (result.ok) {
      setCurrent(result.data)
      setEditing(false)
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
    deletePending,
    startEdit: () => setEditing(true),
    cancelEdit: () => setEditing(false),
    handleDelete: deleteAction ? handleDelete : undefined,
  }
}
