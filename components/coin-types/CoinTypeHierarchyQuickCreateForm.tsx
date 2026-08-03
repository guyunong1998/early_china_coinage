'use client'

import { useActionState } from 'react'
import { createCoinTypeHierarchy } from '@/lib/admin/taxonomy-actions'
import type { ActionState } from '@/lib/admin/types'
import type { CoinTypeHierarchyRow } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

const INITIAL: ActionState<CoinTypeHierarchyRow> = {
  ok: true,
  data: {
    id: '',
    level1_zh: null,
    level1_en: null,
    level2_zh: null,
    level2_en: null,
    level3_zh: null,
    level3_en: null,
    level4_zh: null,
    level4_en: null,
    level5_zh: null,
    level5_en: null,
    img_acc_num: null,
    description_zh: null,
    description_en: null,
  },
}

const LEVEL_NAMES = [
  { level: 1, name: 'Coin/Mould' },
  { level: 2, name: 'Category' },
  { level: 3, name: 'Type' },
  { level: 4, name: 'Subtype' },
  { level: 5, name: 'Variant' },
] as const

function hierarchyLabel(row: CoinTypeHierarchyRow): string {
  return [row.level1_zh, row.level2_zh, row.level3_zh, row.level4_zh, row.level5_zh].filter(Boolean).join(' › ')
}

export function CoinTypeHierarchyQuickCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (opt: ComboOption) => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState<CoinTypeHierarchyRow>, FormData>(
    async (prev, formData) => {
      const result = await createCoinTypeHierarchy(prev, formData)
      if (result.ok) onCreated({ value: result.data.id, label: hierarchyLabel(result.data) || '(unlabeled)' })
      return result
    },
    INITIAL
  )

  return (
    <form action={formAction} className="space-y-3">
      <ActionFormStatus state={state} />
      <p className="text-xs text-gray-500">Fill in as many levels as apply — most nodes only use the first 2–3.</p>
      {LEVEL_NAMES.map(({ level, name }) => (
        <div key={level} className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>{`Level ${level} – ${name} (zh)`}</FieldLabel>
            <input name={`level${level}_zh`} autoFocus={level === 1} className={fieldInputClass} />
          </div>
          <div>
            <FieldLabel>{`Level ${level} – ${name} (en)`}</FieldLabel>
            <input name={`level${level}_en`} className={fieldInputClass} />
          </div>
        </div>
      ))}
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
