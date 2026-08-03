'use client'

import { updateCoinIssue } from '@/lib/admin/coin-issues-actions'
import type { CoinIssueDisplay } from '@/lib/types'
import { ActionFormStatus } from '@/components/edit/ActionFormStatus'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import { TaxonomyCombobox, type ComboOption } from '@/components/edit/TaxonomyCombobox'
import { useEditableSection } from '@/components/edit/useEditableSection'
import { CoinTypeHierarchyQuickCreateForm } from './CoinTypeHierarchyQuickCreateForm'
import { InscriptionQuickCreateForm } from './InscriptionQuickCreateForm'
import { MintQuickCreateForm } from './MintQuickCreateForm'
import { StateQuickCreateForm } from './StateQuickCreateForm'

export function CoinIssueRow({
  issue,
  isDevMode,
  mintOptions,
  stateOptions,
  inscriptionOptions,
  hierarchyOptions,
  onSaved,
}: {
  issue: CoinIssueDisplay
  isDevMode: boolean
  mintOptions: ComboOption[]
  stateOptions: ComboOption[]
  inscriptionOptions: ComboOption[]
  hierarchyOptions: ComboOption[]
  onSaved?: (issue: CoinIssueDisplay) => void
}) {
  const { editing, current, state, formAction, pending, startEdit, cancelEdit } = useEditableSection<CoinIssueDisplay>({
    data: issue,
    action: async (prev, formData) => {
      const result = await updateCoinIssue(prev, formData)
      if (result.ok) onSaved?.(result.data)
      return result
    },
  })

  const typeZh = current.minor_type_zh ?? current.major_type_zh
  const typeEn = current.minor_type_zh ? current.minor_type_en : current.major_type_en

  if (!isDevMode || !editing) {
    return (
      <tr className="border-b border-gray-50 align-top">
        <td className="py-2 pr-4 font-mono text-xs">{current.coin_type_code}</td>
        <td className="py-2 pr-4 text-gray-600">
          {typeZh ?? '—'}
          {typeEn && <span className="ml-1 text-xs italic text-gray-400">({typeEn})</span>}
        </td>
        <td className="py-2 pr-4">
          {current.inscription ?? '—'}
          {current.inscription_en && current.inscription_en !== current.inscription && (
            <span className="ml-1 text-xs italic text-gray-400">({current.inscription_en})</span>
          )}
        </td>
        <td className="py-2 pr-4 text-gray-600">
          {current.state_zh ?? '—'}
          {current.state_en && <span className="ml-1 text-xs italic text-gray-400">({current.state_en})</span>}
        </td>
        <td className="py-2 pr-4 text-gray-600">
          {current.mint_zh ?? '—'}
          {current.mint_en && <span className="ml-1 text-xs italic text-gray-400">({current.mint_en})</span>}
        </td>
        <td className="py-2 text-gray-600">
          <div className="flex items-start justify-between gap-2">
            <span>
              {current.description_zh && <div>{current.description_zh}</div>}
              {current.description_en && (
                <div className={current.description_zh ? 'italic text-gray-400' : undefined}>
                  {current.description_en}
                </div>
              )}
              {!current.description_zh && !current.description_en && '—'}
            </span>
            {isDevMode && (
              <button
                type="button"
                onClick={startEdit}
                className="shrink-0 text-xs font-semibold text-brand hover:underline"
              >
                Edit
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={6} className="bg-brand-light/20 p-3">
        <form action={formAction} className="space-y-3 rounded border border-brand/30 bg-white p-3">
          <ActionFormStatus state={state} />
          <input type="hidden" name="id" value={current.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Coin type code</FieldLabel>
              <input name="coin_type_code" defaultValue={current.coin_type_code ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Mint</FieldLabel>
              <TaxonomyCombobox
                name="mint_id"
                options={mintOptions}
                initialValue={current.mint_id}
                initialLabel={current.mint_zh}
                placeholder="No mint assigned"
                addNewLabel="Add new mint"
                renderAddForm={({ onCreated, onCancel }) => (
                  <MintQuickCreateForm onCreated={onCreated} onCancel={onCancel} />
                )}
              />
            </div>
            <div>
              <FieldLabel>State</FieldLabel>
              <TaxonomyCombobox
                name="state_id"
                options={stateOptions}
                initialValue={current.state_id}
                initialLabel={current.state_zh}
                placeholder="No state assigned"
                addNewLabel="Add new state"
                renderAddForm={({ onCreated, onCancel }) => (
                  <StateQuickCreateForm onCreated={onCreated} onCancel={onCancel} />
                )}
              />
            </div>
            <div>
              <FieldLabel>Inscription</FieldLabel>
              <TaxonomyCombobox
                name="inscription_id"
                options={inscriptionOptions}
                initialValue={current.inscription_id}
                initialLabel={current.inscription}
                placeholder="No inscription assigned"
                addNewLabel="Add new inscription"
                renderAddForm={({ onCreated, onCancel }) => (
                  <InscriptionQuickCreateForm onCreated={onCreated} onCancel={onCancel} />
                )}
              />
            </div>
            <div>
              <FieldLabel>Typology (hierarchy)</FieldLabel>
              <TaxonomyCombobox
                name="coin_type_hierarchy_id"
                options={hierarchyOptions}
                initialValue={current.coin_type_hierarchy_id}
                initialLabel={typeZh}
                placeholder="No typology assigned"
                addNewLabel="Add new typology node"
                renderAddForm={({ onCreated, onCancel }) => (
                  <CoinTypeHierarchyQuickCreateForm onCreated={onCreated} onCancel={onCancel} />
                )}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Description (zh)</FieldLabel>
              <textarea
                name="description_zh"
                defaultValue={current.description_zh ?? ''}
                rows={2}
                className={fieldInputClass}
              />
            </div>
            <div>
              <FieldLabel>Description (en)</FieldLabel>
              <textarea
                name="description_en"
                defaultValue={current.description_en ?? ''}
                rows={2}
                className={fieldInputClass}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  )
}
