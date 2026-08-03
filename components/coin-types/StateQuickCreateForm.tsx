'use client'

import { useActionState } from 'react'
import { createState } from '@/lib/admin/taxonomy-actions'
import type { ActionState } from '@/lib/admin/types'
import type { State } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

const INITIAL: ActionState<State> = { ok: true, data: { id: '', state_zh: '', state_en: null } }

export function StateQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState<State>, FormData>(async (prev, formData) => {
    const result = await createState(prev, formData)
    if (result.ok) onCreated({ value: result.data.id, label: result.data.state_zh })
    return result
  }, INITIAL)

  return (
    <form action={formAction} className="space-y-3">
      <ActionFormStatus state={state} />
      <div>
        <FieldLabel>State (zh)</FieldLabel>
        <input name="state_zh" required autoFocus className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>State (en)</FieldLabel>
        <input name="state_en" className={fieldInputClass} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
