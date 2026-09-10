'use client'

import { createInscription } from '@/lib/admin/taxonomy-actions'
import type { Inscription } from '@/lib/types'
import { TaxonomyQuickCreateForm } from '@/components/coin-types/TaxonomyQuickCreateForm'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

export function InscriptionQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  return (
    <TaxonomyQuickCreateForm<Inscription>
      initial={{ id: '', inscription_zh: null, inscription_en: null }}
      createAction={createInscription}
      toOption={(data) => ({ value: data.id, label: data.inscription_zh ?? '(no text)' })}
      fields={[
        { name: 'inscription_zh', label: 'Inscription (zh)' },
        { name: 'inscription_en', label: 'Inscription (en)' },
      ]}
      onCreated={onCreated}
      onCancel={onCancel}
    />
  )
}
