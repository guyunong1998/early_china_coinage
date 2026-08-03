import { z } from 'zod'

/** HTML forms submit '' for empty text inputs; nullable DB columns want
 * null, not ''. Every optional text field uses this. */
const optionalText = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().trim().nullable()
)

const optionalNumber = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number().nullable()
)

const optionalUuid = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().uuid().nullable()
)

/** Like optionalText, but also tolerates the key being entirely absent from
 * FormData (not even ''), passing through as `undefined` — an `.update()`
 * payload's `undefined` values are dropped by JSON.stringify before the
 * request is sent, so the column is left untouched rather than nulled. Used
 * for fields a compact edit form doesn't surface (so there's no correct
 * value to submit either way), e.g. coin_issues.reverse_inscription/note_*. */
const omittableText = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().trim().nullable().optional()
)

const requiredText = z.string().trim().min(1, 'Required')

/** A textarea edited one entry per line, parsed to a text[] column — blank
 * lines dropped. Used for mints.sources_unlinked: deleting a line removes
 * that unlinked citation on save. */
const textLines = z.preprocess((v) => {
  if (typeof v !== 'string') return []
  return v
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}, z.array(z.string()))

// ── mints ────────────────────────────────────────────────────────────────

export const mintSchema = z.object({
  id: z.string().uuid(),
  name_zh: requiredText,
  name_en: optionalText,
  precision_level: optionalNumber,
  latitude: optionalNumber,
  longitude: optionalNumber,
  description_zh: optionalText,
  description_en: optionalText,
  citation: optionalText,
  state_id: optionalUuid,
  modern_location_zh: optionalText,
  modern_location_en: optionalText,
  location_note: optionalText,
  sources_unlinked: textLines,
  alternative_names: textLines,
})

export const createMintSchema = mintSchema.omit({ id: true })

// ── taxonomy quick-create ───────────────────────────────────────────────

export const stateSchema = z.object({
  state_zh: requiredText,
  state_en: optionalText,
})

export const inscriptionSchema = z.object({
  inscription_zh: optionalText,
  inscription_en: optionalText,
})

export const coinTypeHierarchySchema = z.object({
  level1_zh: optionalText,
  level1_en: optionalText,
  level2_zh: optionalText,
  level2_en: optionalText,
  level3_zh: optionalText,
  level3_en: optionalText,
  level4_zh: optionalText,
  level4_en: optionalText,
  level5_zh: optionalText,
  level5_en: optionalText,
  name_zh: optionalText,
  name_en: optionalText,
})

/** Editing an existing typology node's description (coin-types detail page),
 * distinct from coinTypeHierarchySchema above (which is for creating a new
 * node via the taxonomy combobox's "+Add" popup and doesn't touch description). */
export const coinTypeHierarchyDescriptionSchema = z.object({
  id: z.string().uuid(),
  description_zh: optionalText,
  description_en: optionalText,
})

// ── sites / contexts / finds ────────────────────────────────────────────

export const siteSchema = z.object({
  site_code: requiredText,
  site_name_zh: requiredText,
  site_name_en: optionalText,
  province_zh: optionalText,
  province_en: optionalText,
  city_zh: optionalText,
  city_en: optionalText,
  county_zh: optionalText,
  county_en: optionalText,
  location_detail_zh: optionalText,
  location_detail_en: optionalText,
  lat: optionalNumber,
  lng: optionalNumber,
  precision_level: optionalNumber,
  site_type_zh: optionalText,
  site_type_en: optionalText,
  period_zh: optionalText,
  period_en: optionalText,
  description_zh: optionalText,
  description_en: optionalText,
  note_zh: optionalText,
  note_en: optionalText,
})

export const contextSchema = z.object({
  id: z.string().uuid().optional(),
  context_code: requiredText,
  site_code: requiredText,
  context_name_zh: requiredText,
  context_name_en: optionalText,
  context_original_code: optionalText,
  context_type_zh: optionalText,
  context_type_en: optionalText,
  period_zh: optionalText,
  period_en: optionalText,
  description_zh: optionalText,
  description_en: optionalText,
  note_zh: optionalText,
  note_en: optionalText,
})

export const findSchema = z.object({
  id: z.string().uuid().optional(),
  find_code: requiredText,
  context_code: requiredText,
  coin_issues_id: optionalUuid,
  presence: z.preprocess((v) => v === 'true' || v === true, z.boolean()),
  quantity_total: optionalNumber,
  quantity_min: optionalNumber,
  quantity_max: optionalNumber,
  quantity_estimated: optionalNumber,
  quantity_is_estimated: z.preprocess((v) => v === 'true' || v === true, z.boolean()),
  total_weight_g: optionalNumber,
  // Not surfaced in the compact find edit row — omittable so an absent
  // field leaves the existing DB value alone instead of nulling it (same
  // pattern as coinIssueSchema's note_zh/note_en below).
  quantity_note_zh: omittableText,
  quantity_note_en: omittableText,
  description_zh: optionalText,
  description_en: optionalText,
  note_zh: optionalText,
  note_en: optionalText,
})

// ── coin_issues ──────────────────────────────────────────────────────────

export const coinIssueSchema = z.object({
  id: z.string().uuid(),
  coin_type_code: optionalText,
  description_zh: optionalText,
  description_en: optionalText,
  // Not surfaced in the compact coin-issue edit row — omittable so an
  // absent field leaves the existing DB value alone instead of nulling it.
  note_zh: omittableText,
  note_en: omittableText,
  reverse_inscription: omittableText,
  mint_id: optionalUuid,
  state_id: optionalUuid,
  inscription_id: optionalUuid,
  coin_type_hierarchy_id: optionalUuid,
})

// ── sources / source_links ──────────────────────────────────────────────

export const sourceSchema = z.object({
  id: z.string().uuid().optional(),
  source_code: requiredText,
  author_zh: optionalText,
  author_en: optionalText,
  title_zh: optionalText,
  title_en: optionalText,
  language: optionalText,
  year: optionalNumber,
  publication_zh: optionalText,
  publication_en: optionalText,
  page: optionalText,
  citation_zh: optionalText,
  citation_en: optionalText,
  url: optionalText,
  note_zh: optionalText,
  note_en: optionalText,
})

export const sourceLinkSchema = z.object({
  id: z.string().uuid().optional(),
  source_link_code: requiredText,
  source_code: requiredText,
  target_type: z.enum(['site', 'context', 'find', 'coin_item']),
  target_code: requiredText,
  page: optionalText,
  note_zh: optionalText,
  note_en: optionalText,
})

/** source_link_code is server-generated (see lib/admin/source-links-actions.ts), not user-submitted. */
export const createSourceLinkSchema = sourceLinkSchema.omit({ id: true, source_link_code: true })
