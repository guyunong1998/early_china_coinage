'use client'

import { useActionState, useState } from 'react'
import { createSourceLink } from '@/lib/admin/source-links-actions'
import { searchTargetsAction } from '@/lib/admin/target-search-action'
import type { TargetType } from '@/lib/admin/target-search'
import type { ActionState } from '@/lib/admin/types'
import type { SourceLink } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import { TargetSearchCombobox } from '@/components/edit/TargetSearchCombobox'

const TARGET_TYPES: { value: TargetType; label: string }[] = [
  { value: 'site', label: 'Site' },
  { value: 'context', label: 'Context' },
  { value: 'find', label: 'Find' },
  { value: 'coin_item', label: 'Coin item' },
  { value: 'mint', label: 'Mint' },
]

const INITIAL: ActionState<SourceLink> = {
  ok: true,
  data: {
    id: '',
    source_link_code: '',
    source_code: '',
    target_type: 'site',
    target_code: '',
    page: null,
    note_zh: null,
    note_en: null,
  },
}

/**
 * Inline "+ Add citation" form, used on both /sources (SourceCard, where the
 * citing source is fixed — `sourceCode` provided) and the site detail page's
 * Sources & Citations tab (where the target is fixed to that site instead —
 * `defaultTargetType`/`defaultTargetCode` provided, and the citing source is
 * picked by typing its exact source_code, since there's no source search
 * combobox yet — the /sources page lists every code in `[N] SRC_CODE` form).
 */
export function AddSourceLinkForm({
  sourceCode,
  defaultTargetType,
  defaultTargetCode,
  defaultTargetLabel,
  onCreated,
  onCancel,
}: {
  sourceCode?: string
  defaultTargetType?: TargetType
  defaultTargetCode?: string
  defaultTargetLabel?: string
  onCreated: (link: SourceLink) => void
  onCancel: () => void
}) {
  const [targetType, setTargetType] = useState<TargetType>(defaultTargetType ?? 'site')

  const [state, formAction, pending] = useActionState<ActionState<SourceLink>, FormData>(async (prev, formData) => {
    const result = await createSourceLink(prev, formData)
    if (result.ok) onCreated(result.data)
    return result
  }, INITIAL)

  return (
    <form action={formAction} className="space-y-3 rounded border border-brand/30 bg-brand-light/20 p-3">
      <ActionFormStatus state={state} />
      <fieldset disabled={pending} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {sourceCode ? (
          <input type="hidden" name="source_code" value={sourceCode} />
        ) : (
          <div>
            <FieldLabel>Source code</FieldLabel>
            <input name="source_code" required placeholder="e.g. SRC0123" className={fieldInputClass} />
          </div>
        )}
        <div>
          <FieldLabel>Cites</FieldLabel>
          <select
            name="target_type"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as TargetType)}
            disabled={!!defaultTargetType}
            className={fieldInputClass}
          >
            {TARGET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Record</FieldLabel>
          {defaultTargetCode ? (
            <>
              <input type="hidden" name="target_code" value={defaultTargetCode} />
              <p className={`${fieldInputClass} bg-gray-50 text-gray-600`}>{defaultTargetLabel ?? defaultTargetCode}</p>
            </>
          ) : (
            <TargetSearchCombobox
              key={targetType}
              name="target_code"
              targetType={targetType}
              searchAction={searchTargetsAction}
              placeholder="Search by code or name…"
            />
          )}
        </div>
        <div>
          <FieldLabel>Page</FieldLabel>
          <input name="page" className={fieldInputClass} />
        </div>
      </div>
      <div>
        <FieldLabel>Note</FieldLabel>
        <textarea name="note_zh" rows={2} className={fieldInputClass} />
      </div>
      </fieldset>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add citation'}
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
