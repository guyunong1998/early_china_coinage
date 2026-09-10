'use client'

import { createState } from '@/lib/admin/taxonomy-actions'
import type { State } from '@/lib/types'
import { TaxonomyQuickCreateForm } from '@/components/coin-types/TaxonomyQuickCreateForm'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

export function StateQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  return (
    <TaxonomyQuickCreateForm<State>
      initial={{ id: '', state_zh: '', state_en: null }}
      createAction={createState}
      toOption={(data) => ({ value: data.id, label: data.state_zh })}
      fields={[
        { name: 'state_zh', label: 'State (zh)', required: true },
        { name: 'state_en', label: 'State (en)' },
      ]}
      onCreated={onCreated}
      onCancel={onCancel}
    />
  )
}
