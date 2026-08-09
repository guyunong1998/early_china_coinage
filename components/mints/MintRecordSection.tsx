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
        <div>
          <FieldLabel>State ID (uuid, references states.id)</FieldLabel>
          <input name="state_id" defaultValue={mint.state_id ?? ''} className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Modern location (zh)</FieldLabel>
          <input name="modern_location_zh" defaultValue={mint.modern_location_zh ?? ''} className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Modern location (en)</FieldLabel>
          <input name="modern_location_en" defaultValue={mint.modern_location_en ?? ''} className={fieldInputClass} />
        </div>
      </div>
      <div>
        <FieldLabel>Location note</FieldLabel>
        <textarea name="location_note" defaultValue={mint.location_note ?? ''} rows={2} className={fieldInputClass} />
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
      <div>
        <FieldLabel>Unlinked sources (one per line — delete a line to drop it)</FieldLabel>
        <textarea
          name="sources_unlinked"
          defaultValue={(mint.sources_unlinked ?? []).join('\n')}
          rows={4}
          className={fieldInputClass}
        />
      </div>
      <div>
        <FieldLabel>Alternative names (one per line — other spellings this mint is known by)</FieldLabel>
        <textarea
          name="alternative_names"
          defaultValue={(mint.alternative_names ?? []).join('\n')}
          rows={2}
          className={fieldInputClass}
        />
      </div>
    </>
  )
}

/** The raw `mints` DB record, editable in place. Everything shown on the
 * mint page — description, state, modern location, location_note, images
 * (via image_ids), and sources_unlinked — lives on this table now. */
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
            label="Mint code (URL slug)"
            value={<code className="font-mono">{m.mint_code}</code>}
          />
          <FieldRow
            label="Coordinates"
            value={m.latitude != null && m.longitude != null ? `${m.latitude}, ${m.longitude}` : '—'}
          />
          <FieldRow label="Precision level" value={m.precision_level ?? '—'} />
          <FieldRow label="State ID" value={m.state_id ?? '—'} />
          <FieldRow
            label="Modern location"
            value={
              m.modern_location_zh || m.modern_location_en
                ? `${m.modern_location_zh ?? ''}${m.modern_location_zh && m.modern_location_en ? ' / ' : ''}${m.modern_location_en ?? ''}`
                : '—'
            }
          />
          <FieldRow label="Location note" value={m.location_note ?? '—'} />
          <FieldRow label="Description (zh)" value={m.description_zh ?? '—'} />
          <FieldRow label="Description (en)" value={m.description_en ?? '—'} />
          <FieldRow label="Citation" value={m.citation ?? '—'} />
          <FieldRow
            label="Unlinked sources"
            value={
              m.sources_unlinked.length > 0 ? (
                <ul className="list-disc pl-4">
                  {m.sources_unlinked.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                '—'
              )
            }
          />
          <FieldRow label="Alternative names" value={m.alternative_names.length > 0 ? m.alternative_names.join(', ') : '—'} />
        </dl>
      )}
      renderForm={(m) => <MintFormFields mint={m} />}
    />
  )
}
