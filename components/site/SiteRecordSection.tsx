'use client'

import { updateSite } from '@/lib/admin/sites-actions'
import type { Site } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, FieldRow, fieldInputClass } from '@/components/edit/FieldRow'

const TEXTAREA_ROWS = 3

/** Editable view of the raw `sites` table row — dev-only, rendered as a
 * supplementary panel by the site page (never shown at all in production,
 * since its fields already appear split across the Location/Information
 * cards above it). */
export function SiteRecordSection({ site }: { site: Site }) {
  return (
    <EditableSection
      data={site}
      isDevMode
      action={updateSite}
      renderDisplay={(s) => (
        <dl>
          <FieldRow label="Site code" value={<span className="font-mono text-xs">{s.site_code}</span>} />
          <FieldRow
            label="Name"
            value={
              <>
                {s.site_name_zh}
                {s.site_name_en && <span className="ml-2 text-xs italic text-gray-400">({s.site_name_en})</span>}
              </>
            }
          />
          <FieldRow label="Province / City / County" value={[s.province_zh, s.city_zh, s.county_zh].filter(Boolean).join(' · ') || '—'} />
          <FieldRow label="Location detail" value={s.location_detail_zh || s.location_detail_en || '—'} />
          <FieldRow label="Coordinates" value={s.lat != null && s.lng != null ? `${s.lat}, ${s.lng}` : '—'} />
          <FieldRow label="Precision level" value={s.precision_level ?? '—'} />
          <FieldRow label="Site type" value={s.site_type_zh || s.site_type_en || '—'} />
          <FieldRow label="Period" value={s.period_zh || s.period_en || '—'} />
          <FieldRow label="Description (zh)" value={s.description_zh ?? '—'} />
          <FieldRow label="Description (en)" value={s.description_en ?? '—'} />
          <FieldRow label="Note" value={s.note_zh || s.note_en || '—'} />
        </dl>
      )}
      renderForm={(s) => (
        <>
          <input type="hidden" name="site_code" value={s.site_code} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Name (zh)</FieldLabel>
              <input name="site_name_zh" defaultValue={s.site_name_zh ?? ''} required className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Name (en)</FieldLabel>
              <input name="site_name_en" defaultValue={s.site_name_en ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Province (zh)</FieldLabel>
              <input name="province_zh" defaultValue={s.province_zh ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Province (en)</FieldLabel>
              <input name="province_en" defaultValue={s.province_en ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>City (zh)</FieldLabel>
              <input name="city_zh" defaultValue={s.city_zh ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>City (en)</FieldLabel>
              <input name="city_en" defaultValue={s.city_en ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>County (zh)</FieldLabel>
              <input name="county_zh" defaultValue={s.county_zh ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>County (en)</FieldLabel>
              <input name="county_en" defaultValue={s.county_en ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Latitude</FieldLabel>
              <input name="lat" type="number" step="any" defaultValue={s.lat ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Longitude</FieldLabel>
              <input name="lng" type="number" step="any" defaultValue={s.lng ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Precision level</FieldLabel>
              <input
                name="precision_level"
                type="number"
                defaultValue={s.precision_level ?? ''}
                className={fieldInputClass}
              />
            </div>
            <div>
              <FieldLabel>Site type (zh)</FieldLabel>
              <input name="site_type_zh" defaultValue={s.site_type_zh ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Site type (en)</FieldLabel>
              <input name="site_type_en" defaultValue={s.site_type_en ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Period (zh)</FieldLabel>
              <input name="period_zh" defaultValue={s.period_zh ?? ''} className={fieldInputClass} />
            </div>
            <div>
              <FieldLabel>Period (en)</FieldLabel>
              <input name="period_en" defaultValue={s.period_en ?? ''} className={fieldInputClass} />
            </div>
          </div>
          <div>
            <FieldLabel>Location detail (zh)</FieldLabel>
            <textarea
              name="location_detail_zh"
              defaultValue={s.location_detail_zh ?? ''}
              rows={2}
              className={fieldInputClass}
            />
          </div>
          <div>
            <FieldLabel>Location detail (en)</FieldLabel>
            <textarea
              name="location_detail_en"
              defaultValue={s.location_detail_en ?? ''}
              rows={2}
              className={fieldInputClass}
            />
          </div>
          <div>
            <FieldLabel>Description (zh)</FieldLabel>
            <textarea
              name="description_zh"
              defaultValue={s.description_zh ?? ''}
              rows={TEXTAREA_ROWS}
              className={fieldInputClass}
            />
          </div>
          <div>
            <FieldLabel>Description (en)</FieldLabel>
            <textarea
              name="description_en"
              defaultValue={s.description_en ?? ''}
              rows={TEXTAREA_ROWS}
              className={fieldInputClass}
            />
          </div>
          <div>
            <FieldLabel>Note (zh)</FieldLabel>
            <textarea name="note_zh" defaultValue={s.note_zh ?? ''} rows={2} className={fieldInputClass} />
          </div>
          <div>
            <FieldLabel>Note (en)</FieldLabel>
            <textarea name="note_en" defaultValue={s.note_en ?? ''} rows={2} className={fieldInputClass} />
          </div>
        </>
      )}
    />
  )
}
