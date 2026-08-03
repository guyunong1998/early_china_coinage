'use client'

import type { ActionState } from '@/lib/admin/types'
import { ActionFormStatus } from './ActionFormStatus'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import { useEditableSection } from './useEditableSection'

/**
 * Convenience wrapper around useEditableSection for panel/card layouts (not
 * table rows — see FindRow/CoinIssueRow, which use the hook directly so they
 * can render a proper <tr>). Not editing: shows renderDisplay plus (in dev)
 * a small Edit/Delete bar. Editing: shows renderForm inside a <form> with
 * Save/Cancel wired to the action.
 */
export function EditableSection<T>({
  data,
  isDevMode,
  action,
  renderDisplay,
  renderForm,
  deleteAction,
  onDeleted,
  startInEditing = false,
  onCancelCreate,
  deleteInFormOnly = false,
}: {
  data: T
  isDevMode: boolean
  action: (prev: ActionState<T>, formData: FormData) => Promise<ActionState<T>>
  renderDisplay: (data: T) => React.ReactNode
  renderForm: (data: T) => React.ReactNode
  deleteAction?: () => Promise<ActionState<T>>
  onDeleted?: () => void
  startInEditing?: boolean
  /** Called on Cancel while creating (startInEditing=true) so the parent list
   * can drop this blank instance. */
  onCancelCreate?: () => void
  /** When true, Delete only appears inside the edit form (bottom, next to
   * Save/Cancel) — the user must click Edit first. Default false keeps
   * Delete alongside Edit in the display-mode overlay. */
  deleteInFormOnly?: boolean
}) {
  const { editing, current, state, formAction, pending, deletePending, startEdit, cancelEdit, handleDelete } =
    useEditableSection({ data, action, deleteAction, onDeleted, startInEditing })

  if (!isDevMode) {
    return <>{renderDisplay(current)}</>
  }

  if (!editing) {
    return (
      <div className="relative">
        <div className="absolute right-1 top-1 z-10 flex gap-2 rounded bg-white/90 px-1.5 py-0.5 shadow-sm">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Edit
          </button>
          {!deleteInFormOnly && handleDelete && (
            <ConfirmDeleteButton pending={deletePending} onConfirm={handleDelete} />
          )}
        </div>
        {renderDisplay(current)}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-brand/30 bg-brand-light/20 p-3">
      <ActionFormStatus state={state} />
      {renderForm(current)}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              cancelEdit()
              onCancelCreate?.()
            }}
            className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {deleteInFormOnly && handleDelete && <ConfirmDeleteButton pending={deletePending} onConfirm={handleDelete} />}
      </div>
    </form>
  )
}
