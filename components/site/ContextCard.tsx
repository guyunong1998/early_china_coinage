'use client'

import { createContext, deleteContext, updateContext } from '@/lib/admin/sites-actions'
import type { ActionState } from '@/lib/admin/types'
import type { Context } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'

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

function biBlock(zh: string | null | undefined, en: string | null | undefined) {
  const a = zh?.trim()
  const b = en?.trim()
  if (!a && !b) return <span className="text-gray-400">—</span>
  return (
    <div className="space-y-1">
      {a && <p>{a}</p>}
      {b && b !== a && <p className="italic text-gray-500">{b}</p>}
    </div>
  )
}

function ContextFields({ ctx }: { ctx: Partial<Context> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <FieldLabel>Context code</FieldLabel>
        <input name="context_code" defaultValue={ctx.context_code ?? ''} required className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Original code</FieldLabel>
        <input name="context_original_code" defaultValue={ctx.context_original_code ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Name (zh)</FieldLabel>
        <input name="context_name_zh" defaultValue={ctx.context_name_zh ?? ''} required className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Name (en)</FieldLabel>
        <input name="context_name_en" defaultValue={ctx.context_name_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Type (zh)</FieldLabel>
        <input name="context_type_zh" defaultValue={ctx.context_type_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Type (en)</FieldLabel>
        <input name="context_type_en" defaultValue={ctx.context_type_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Period (zh)</FieldLabel>
        <input name="period_zh" defaultValue={ctx.period_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Period (en)</FieldLabel>
        <input name="period_en" defaultValue={ctx.period_en ?? ''} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Description (zh)</FieldLabel>
        <textarea name="description_zh" defaultValue={ctx.description_zh ?? ''} rows={2} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Description (en)</FieldLabel>
        <textarea name="description_en" defaultValue={ctx.description_en ?? ''} rows={2} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Note (zh)</FieldLabel>
        <textarea name="note_zh" defaultValue={ctx.note_zh ?? ''} rows={2} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Note (en)</FieldLabel>
        <textarea name="note_en" defaultValue={ctx.note_en ?? ''} rows={2} className={fieldInputClass} />
      </div>
    </div>
  )
}

/** One labeled "Legend: value" line — used instead of dangling, unlabeled
 * text so Code/State/Period are unambiguous at a glance. */
function FieldLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-600">
      <span className="font-semibold text-gray-500">{label}:</span> {children}
    </p>
  )
}

function ContextDisplay({ ctx, breakdownSlot }: { ctx: Context; breakdownSlot?: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-12">
      {/* Text column — fixed half so the chart column alongside it is
          always the other half, consistent across every context card. */}
      <div className="md:col-span-6">
        <h3 className="font-semibold text-brand">{ctx.context_name_zh ?? ctx.context_code}</h3>
        {ctx.context_name_en && ctx.context_name_en !== ctx.context_name_zh && (
          <p className="text-sm italic text-gray-500">{ctx.context_name_en}</p>
        )}
        <div className="mt-2 space-y-0.5">
          <FieldLine label="Code">
            <span className="font-mono text-xs text-gray-500">{ctx.context_code}</span>
          </FieldLine>
          {(ctx.context_type_zh || ctx.context_type_en) && (
            <FieldLine label="State">{bi(ctx.context_type_zh, ctx.context_type_en)}</FieldLine>
          )}
          {(ctx.period_zh || ctx.period_en) && <FieldLine label="Period">{bi(ctx.period_zh, ctx.period_en)}</FieldLine>}
        </div>
        {(ctx.description_zh || ctx.description_en) && (
          <div className="mt-2 text-sm">{biBlock(ctx.description_zh, ctx.description_en)}</div>
        )}
        {(ctx.note_zh || ctx.note_en) && <div className="mt-1 text-xs text-gray-400">{biBlock(ctx.note_zh, ctx.note_en)}</div>}
      </div>
      {/* Chart column — always reserved at half, whether or not this
          context has a breakdown to show. */}
      <div className="md:col-span-6">{breakdownSlot}</div>
    </div>
  )
}

const BLANK_CONTEXT: Context = {
  id: '',
  context_code: '',
  site_code: '',
  context_name_zh: '',
  context_name_en: null,
  context_original_code: null,
  context_type_zh: null,
  context_type_en: null,
  period_zh: null,
  period_en: null,
  description_zh: null,
  description_en: null,
  source_code: null,
  note_zh: null,
  note_en: null,
}

export function ContextCard({
  ctx,
  siteCode,
  isDevMode,
  breakdownSlot,
  onSaved,
  onDeleted,
  isNew = false,
  onCancelCreate,
}: {
  /** Unused when isNew (BLANK_CONTEXT is used instead) — optional so callers
   * adding a brand-new context don't need an existing row to pass. */
  ctx?: Context
  siteCode: string
  isDevMode: boolean
  breakdownSlot?: React.ReactNode
  onSaved?: (ctx: Context) => void
  onDeleted?: () => void
  isNew?: boolean
  onCancelCreate?: () => void
}) {
  async function handleUpdate(prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
    const result = await updateContext(prev, formData)
    if (result.ok) onSaved?.(result.data)
    return result
  }

  async function handleCreate(prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
    const result = await createContext(prev, formData)
    if (result.ok) onSaved?.(result.data)
    return result
  }

  return (
    <div className="panel-record-item p-4">
      <EditableSection
        data={isNew || !ctx ? { ...BLANK_CONTEXT, site_code: siteCode } : ctx}
        isDevMode={isDevMode}
        startInEditing={isNew}
        onCancelCreate={onCancelCreate}
        action={isNew ? handleCreate : handleUpdate}
        deleteAction={
          isNew || !ctx?.id
            ? undefined
            : async () => {
                const result = await deleteContext(ctx.id, siteCode)
                return { ...result, data: ctx }
              }
        }
        onDeleted={onDeleted}
        deleteInFormOnly
        renderDisplay={(c) => <ContextDisplay ctx={c} breakdownSlot={breakdownSlot} />}
        renderForm={(c) => (
          <>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="site_code" value={siteCode} />
            <ContextFields ctx={c} />
          </>
        )}
      />
    </div>
  )
}
