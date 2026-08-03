'use client'

import { useActionState } from 'react'
import { createMint } from '@/lib/admin/mints-actions'
import type { ActionState } from '@/lib/admin/types'
import type { Mint } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

const INITIAL: ActionState<Mint> = {
  ok: true,
  data: {
    id: '',
    name_zh: '',
    name_en: null,
    precision_level: null,
    latitude: null,
    longitude: null,
    description_zh: null,
    description_en: null,
    citation: null,
    state_id: null,
    modern_location_zh: null,
    modern_location_en: null,
    location_note: null,
    image_ids: [],
    sources_unlinked: [],
    mint_code: '',
    alternative_names: [],
  },
}

export function MintQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState<Mint>, FormData>(async (prev, formData) => {
    const result = await createMint(prev, formData)
    if (result.ok) onCreated({ value: result.data.id, label: result.data.name_zh })
    return result
  }, INITIAL)

  return (
    <form action={formAction} className="space-y-3">
      <ActionFormStatus state={state} />
      <div>
        <FieldLabel>Name (zh)</FieldLabel>
        <input name="name_zh" required autoFocus className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Name (en)</FieldLabel>
        <input name="name_en" className={fieldInputClass} />
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
