'use client'

import { updateCoinTypeHierarchyDescription } from '@/lib/admin/taxonomy-actions'
import type { CoinTypeHierarchyRow } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'

export function CoinTypeDescriptionSection({
  ownHierarchyId,
  descriptionZh,
  descriptionEn,
  isDevMode,
  noDescriptionLabel,
}: {
  ownHierarchyId: string | null
  descriptionZh: string | null
  descriptionEn: string | null
  isDevMode: boolean
  noDescriptionLabel: React.ReactNode
}) {
  // No row of its own to attach a description to (a pure grouping bucket —
  // every row under this node subdivides further) — nothing to edit.
  if (!ownHierarchyId) {
    return <p className="text-sm italic text-gray-400">{noDescriptionLabel}</p>
  }

  // EditableSection's T must match updateCoinTypeHierarchyDescription's real
  // return type (the full row) — renderDisplay/renderForm below only ever
  // touch id/description_zh/description_en, so the rest are harmless nulls.
  const data: CoinTypeHierarchyRow = {
    id: ownHierarchyId,
    description_zh: descriptionZh,
    description_en: descriptionEn,
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
  }

  return (
    <EditableSection
      data={data}
      isDevMode={isDevMode}
      action={updateCoinTypeHierarchyDescription}
      renderDisplay={(d) =>
        d.description_zh || d.description_en ? (
          <div className="space-y-2 text-sm">
            {d.description_zh && <p className="leading-7 text-gray-800">{d.description_zh}</p>}
            {d.description_en && <p className="leading-7 italic text-gray-600">{d.description_en}</p>}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">{noDescriptionLabel}</p>
        )
      }
      renderForm={(d) => (
        <>
          <input type="hidden" name="id" value={d.id} />
          <div>
            <FieldLabel>Description (zh)</FieldLabel>
            <textarea name="description_zh" defaultValue={d.description_zh ?? ''} rows={3} className={fieldInputClass} />
          </div>
          <div>
            <FieldLabel>Description (en)</FieldLabel>
            <textarea name="description_en" defaultValue={d.description_en ?? ''} rows={3} className={fieldInputClass} />
          </div>
        </>
      )}
    />
  )
}
