'use client'

import { useActionState } from 'react'
import { createInscription } from '@/lib/admin/taxonomy-actions'
import type { ActionState } from '@/lib/admin/types'
import type { Inscription } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

const INITIAL: ActionState<Inscription> = { ok: true, data: { id: '', inscription_zh: null, inscription_en: null } }

export function InscriptionQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState<Inscription>, FormData>(async (prev, formData) => {
    const result = await createInscription(prev, formData)
    if (result.ok) onCreated({ value: result.data.id, label: result.data.inscription_zh ?? '(no text)' })
    return result
  }, INITIAL)

  return (
    <form action={formAction} className="space-y-3">
      <ActionFormStatus state={state} />
      <div>
        <FieldLabel>Inscription (zh)</FieldLabel>
        <input name="inscription_zh" autoFocus className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Inscription (en)</FieldLabel>
        <input name="inscription_en" className={fieldInputClass} />
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
