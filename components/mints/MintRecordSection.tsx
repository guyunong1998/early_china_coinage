'use client'

import { updateMint } from '@/lib/admin/mints-actions'
import type { Mint } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, FieldRow, fieldInputClass } from '@/components/edit/FieldRow'

/** Shared field markup for both the edit-in-place form (MintRecordSection)
 * and the create-new form (AddMintSection) — the latter simply omits the
 * hidden id input. */
export function MintFormFields({ mint, includeId = true }: { mint: Partial<Mint>; includeId?: boolean }) {
  return (
    <>
      {includeId && mint.id && <input type="hidden" name="id" value={mint.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Name (zh)</FieldLabel>
          <input name="name_zh" defaultValue={mint.name_zh ?? ''} required className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Name (en)</FieldLabel>
          <input name="name_en" defaultValue={mint.name_en ?? ''} className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Latitude</FieldLabel>
          <input
            name="latitude"
            type="number"
            step="any"
            defaultValue={mint.latitude ?? ''}
            className={fieldInputClass}
          />
        </div>
        <div>
          <FieldLabel>Longitude</FieldLabel>
          <input
            name="longitude"
            type="number"
            step="any"
            defaultValue={mint.longitude ?? ''}
            className={fieldInputClass}
          />
        </div>
        <div>
          <FieldLabel>Precision level</FieldLabel>
          <input
            name="precision_level"
            type="number"
            defaultValue={mint.precision_level ?? ''}
            className={fieldInputClass}
          />
        </div>
      </div>
      <div>
        <FieldLabel>Description (zh)</FieldLabel>
        <textarea
          name="description_zh"
          defaultValue={mint.description_zh ?? ''}
          rows={3}
          className={fieldInputClass}
        />
      </div>
      <div>
        <FieldLabel>Description (en)</FieldLabel>
        <textarea
          name="description_en"
          defaultValue={mint.description_en ?? ''}
          rows={3}
          className={fieldInputClass}
        />
      </div>
      <div>
        <FieldLabel>Citation</FieldLabel>
        <textarea name="citation" defaultValue={mint.citation ?? ''} rows={2} className={fieldInputClass} />
      </div>
    </>
  )
}

/** The raw `mints` DB record, editable in place — distinct from the merged
 * dossier-derived panels elsewhere on the mint page (state, modern location,
 * coin types, images, references all come from lib/mint-dossiers.ts, not
 * this table, and aren't editable here). */
export function MintRecordSection({ mint, isDevMode }: { mint: Mint; isDevMode: boolean }) {
  return (
    <EditableSection
      data={mint}
      isDevMode={isDevMode}
      action={updateMint}
      renderDisplay={(m) => (
        <dl>
          <FieldRow
            label="Name"
            value={
              <>
                {m.name_zh}
                {m.name_en && <span className="ml-2 text-xs italic text-gray-400">({m.name_en})</span>}
              </>
            }
          />
          <FieldRow
            label="Coordinates"
            value={m.latitude != null && m.longitude != null ? `${m.latitude}, ${m.longitude}` : '—'}
          />
          <FieldRow label="Precision level" value={m.precision_level ?? '—'} />
          <FieldRow label="Description (zh)" value={m.description_zh ?? '—'} />
          <FieldRow label="Description (en)" value={m.description_en ?? '—'} />
          <FieldRow label="Citation" value={m.citation ?? '—'} />
        </dl>
      )}
      renderForm={(m) => <MintFormFields mint={m} />}
    />
  )
}
