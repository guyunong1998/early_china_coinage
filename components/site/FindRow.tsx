'use client'

import { createFind, deleteFind, updateFind } from '@/lib/admin/sites-actions'
import type { ActionState } from '@/lib/admin/types'
import type { Find } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { ConfirmDeleteButton } from '@/components/edit/ConfirmDeleteButton'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import { TaxonomyCombobox, type ComboOption } from '@/components/edit/TaxonomyCombobox'
import { useEditableSection } from '@/components/edit/useEditableSection'
import { formatNumber } from '@/lib/format'

function bi(zh: string | null | undefined, en: string | null | undefined) {
  const a = zh?.trim()
  const b = en?.trim()
  if (!a && !b) return <span className="text-gray-400">—</span>
  if (!b || b === a) return <span>{a ?? '—'}</span>
  return (
    <span>
      {a}
      <span className="ml-2 text-sm italic text-gray-400">{b}</span>
    </span>
  )
}

const BLANK_FIND: Find = {
  id: '',
  find_code: '',
  context_code: '',
  presence: true,
  quantity_total: null,
  quantity_min: null,
  quantity_max: null,
  quantity_estimated: null,
  quantity_is_estimated: false,
  total_weight_g: null,
  quantity_note_zh: null,
  description_zh: null,
  description_en: null,
  note_zh: null,
  note_en: null,
  coin_issues: null,
}

export function FindRow({
  find,
  contextCode,
  contextOptions,
  isDevMode,
  coinIssueOptions,
  onSaved,
  onDeleted,
  isNew = false,
  onCancelCreate,
}: {
  /** Unused when isNew (BLANK_FIND is used instead) — optional so callers
   * adding a brand-new find don't need an existing row to pass. */
  find?: Find
  contextCode: string
  /** Every context on this site — lets a find's context assignment be
   * changed (and be picked when creating a new find). */
  contextOptions: { context_code: string; label: string }[]
  isDevMode: boolean
  coinIssueOptions: ComboOption[]
  onSaved?: (find: Find) => void
  onDeleted?: () => void
  isNew?: boolean
  onCancelCreate?: () => void
}) {
  const data = isNew || !find ? { ...BLANK_FIND, context_code: contextCode } : find

  async function handleAction(prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
    const result = isNew ? await createFind(prev, formData) : await updateFind(prev, formData)
    if (result.ok) onSaved?.(result.data)
    return result
  }

  const { editing, current, state, formAction, pending, locked, deletePending, startEdit, cancelEdit, handleDelete } =
    useEditableSection<Find>({
      data,
      action: handleAction,
      startInEditing: isNew,
      deleteAction:
        isNew || !find?.id
          ? undefined
          : async () => {
              const result = await deleteFind(find.id)
              return { ...result, data: find }
            },
      onDeleted,
    })

  if (!isDevMode) {
    return (
      <tr className="align-top hover:bg-gray-50">
        <td className="py-2 pr-4 font-mono text-xs">{current.find_code}</td>
        <td className="py-2 pr-4 text-gray-500">{current.context_code}</td>
        <td className="py-2 pr-4">
          {bi(
            current.coin_issues?.minor_type_zh ?? current.coin_issues?.major_type_zh ?? current.description_zh,
            current.coin_issues?.minor_type_en ?? current.coin_issues?.major_type_en ?? current.description_en
          )}
        </td>
        <td className="py-2 pr-4">{bi(current.coin_issues?.inscription, current.coin_issues?.inscription_en)}</td>
        <td className="py-2 pr-4">{bi(current.coin_issues?.state_zh, current.coin_issues?.state_en)}</td>
        <td className="py-2 pr-4">{bi(current.coin_issues?.mint_zh, current.coin_issues?.mint_en)}</td>
        <td className="py-2 text-right tabular-nums">
          {formatNumber(current.quantity_total ?? current.quantity_min ?? current.quantity_estimated)}
        </td>
      </tr>
    )
  }

  if (!editing) {
    return (
      <tr className="align-top hover:bg-gray-50">
        <td className="py-2 pr-4 font-mono text-xs">{current.find_code}</td>
        <td className="py-2 pr-4 text-gray-500">{current.context_code}</td>
        <td className="py-2 pr-4">
          {bi(
            current.coin_issues?.minor_type_zh ?? current.coin_issues?.major_type_zh ?? current.description_zh,
            current.coin_issues?.minor_type_en ?? current.coin_issues?.major_type_en ?? current.description_en
          )}
        </td>
        <td className="py-2 pr-4">{bi(current.coin_issues?.inscription, current.coin_issues?.inscription_en)}</td>
        <td className="py-2 pr-4">{bi(current.coin_issues?.state_zh, current.coin_issues?.state_en)}</td>
        <td className="py-2 pr-4">{bi(current.coin_issues?.mint_zh, current.coin_issues?.mint_en)}</td>
        <td className="py-2 text-right tabular-nums">
          <div className="flex items-center justify-end gap-2">
            {formatNumber(current.quantity_total ?? current.quantity_min ?? current.quantity_estimated)}
            <button type="button" onClick={startEdit} className="text-xs font-semibold text-brand hover:underline">
              Edit
            </button>
            {handleDelete && <ConfirmDeleteButton pending={deletePending} onConfirm={handleDelete} />}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={7} className="bg-brand-light/20 p-3">
        <form action={formAction} className="space-y-3 rounded border border-brand/30 bg-white p-3">
          <ActionFormStatus state={state} />
          <input type="hidden" name="id" value={current.id} />
          <fieldset disabled={locked} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel>Find code</FieldLabel>
              <input name="find_code" defaultValue={current.find_code} required className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Context</FieldLabel>
              <select name="context_code" defaultValue={contextCode} required className={fieldInputClass}>
                {contextOptions.map((c) => (
                  <option key={c.context_code} value={c.context_code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Coin issue</FieldLabel>
              <TaxonomyCombobox
                name="coin_issues_id"
                options={coinIssueOptions}
                initialValue={current.coin_issues?.id ?? null}
                initialLabel={
                  current.coin_issues
                    ? `${current.coin_issues.coin_type_code} — ${
                        current.coin_issues.minor_type_zh ?? current.coin_issues.major_type_zh ?? ''
                      }`
                    : null
                }
                placeholder="No coin issue assigned"
              />
            </div>
            <div>
              <FieldLabel>Quantity (total)</FieldLabel>
              <input
                name="quantity_total"
                type="number"
                defaultValue={current.quantity_total ?? ''}
                className={fieldInputClass}
              />
            </div>
            <div>
              <FieldLabel>Quantity (min)</FieldLabel>
              <input
                name="quantity_min"
                type="number"
                defaultValue={current.quantity_min ?? ''}
                className={fieldInputClass}
              />
            </div>
            <div>
              <FieldLabel>Quantity (max)</FieldLabel>
              <input
                name="quantity_max"
                type="number"
                defaultValue={current.quantity_max ?? ''}
                className={fieldInputClass}
              />
            </div>
            <div>
              <FieldLabel>Quantity (estimated)</FieldLabel>
              <input
                name="quantity_estimated"
                type="number"
                defaultValue={current.quantity_estimated ?? ''}
                className={fieldInputClass}
              />
            </div>
            <div>
              <FieldLabel>Total weight (g)</FieldLabel>
              <input
                name="total_weight_g"
                type="number"
                step="any"
                defaultValue={current.total_weight_g ?? ''}
                className={fieldInputClass}
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" name="presence" value="true" defaultChecked={current.presence ?? true} />
                Present
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  name="quantity_is_estimated"
                  value="true"
                  defaultChecked={current.quantity_is_estimated ?? false}
                />
                Qty estimated
              </label>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Description (zh)</FieldLabel>
              <textarea name="description_zh" defaultValue={current.description_zh ?? ''} rows={2} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Description (en)</FieldLabel>
              <textarea name="description_en" defaultValue={current.description_en ?? ''} rows={2} className={fieldInputClass} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Note (zh)</FieldLabel>
              <textarea name="note_zh" defaultValue={current.note_zh ?? ''} rows={2} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Note (en)</FieldLabel>
              <textarea name="note_en" defaultValue={current.note_en ?? ''} rows={2} className={fieldInputClass} />
            </div>
          </div>
          </fieldset>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={locked}
              className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : locked ? 'Saved ✓' : 'Save'}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                cancelEdit()
                onCancelCreate?.()
              }}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  )
}
