'use client'

import { useActionState } from 'react'
import type { ActionState } from '@/lib/admin/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

type Field = {
  name: string
  label: string
  required?: boolean
}

type TaxonomyQuickCreateFormProps<T> = {
  initial: T
  createAction: (prev: ActionState<T>, formData: FormData) => Promise<ActionState<T>>
  toOption: (data: T) => ComboOption
  fields: Field[]
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}

/**
 * Shared shape behind StateQuickCreateForm / InscriptionQuickCreateForm /
 * MintQuickCreateForm — each is just this with its own create action, seed
 * row, zh/en field pair, and result->ComboOption label. (Not used by
 * CoinTypeHierarchyQuickCreateForm, whose 5-level field loop and label
 * logic are different enough to stay its own component.)
 */
export function TaxonomyQuickCreateForm<T>({
  initial,
  createAction,
  toOption,
  fields,
  onCreated,
  onCancel,
}: TaxonomyQuickCreateFormProps<T>) {
  const [state, formAction, pending] = useActionState<ActionState<T>, FormData>(async (prev, formData) => {
    const result = await createAction(prev, formData)
    if (result.ok) onCreated(toOption(result.data))
    return result
  }, { ok: true, data: initial })

  return (
    <form action={formAction} className="space-y-3">
      <ActionFormStatus state={state} />
      <fieldset disabled={pending} className="space-y-3">
        {fields.map((field, i) => (
          <div key={field.name}>
            <FieldLabel>{field.label}</FieldLabel>
            <input
              name={field.name}
              required={field.required}
              autoFocus={i === 0}
              className={fieldInputClass}
            />
          </div>
        ))}
      </fieldset>
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
          disabled={pending}
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
