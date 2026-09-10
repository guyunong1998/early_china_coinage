'use client'

import { createMint } from '@/lib/admin/mints-actions'
import type { Mint } from '@/lib/types'
import { TaxonomyQuickCreateForm } from '@/components/coin-types/TaxonomyQuickCreateForm'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

const INITIAL: Mint = {
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
}

export function MintQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  return (
    <TaxonomyQuickCreateForm<Mint>
      initial={INITIAL}
      createAction={createMint}
      toOption={(data) => ({ value: data.id, label: data.name_zh })}
      fields={[
        { name: 'name_zh', label: 'Name (zh)', required: true },
        { name: 'name_en', label: 'Name (en)' },
      ]}
      onCreated={onCreated}
      onCancel={onCancel}
    />
  )
}
