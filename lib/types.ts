export type MapSite = {
  site_code: string
  site_name_zh: string | null
  site_name_en: string | null
  province_zh: string | null
  province_en: string | null
  city_zh: string | null
  city_en: string | null
  county_zh: string | null
  county_en: string | null
  location_detail_zh: string | null
  location_detail_en: string | null
  lat: number | null
  lng: number | null
  precision_level: number | null
  site_type_zh: string | null
  site_type_en: string | null
  find_record_count: number | null
  total_quantity_for_map: number | null
  level1_types_zh: string | null
  level2_types_zh: string | null
  level3_types_zh: string | null
  level4_types_zh: string | null
  level5_types_zh: string | null
  level1_types_en: string | null
  level2_types_en: string | null
  level3_types_en: string | null
  level4_types_en: string | null
  level5_types_en: string | null
  inscriptions: string | null
  states_zh: string | null
  mints_zh: string | null
  inscriptions_en: string | null
  states_en: string | null
  mints_en: string | null
}

export type Site = MapSite & {
  id: string
  period_zh: string | null
  period_en: string | null
  description_zh: string | null
  description_en: string | null
  note_zh: string | null
  note_en: string | null
  created_at: string
}

export type Context = {
  id: string
  context_code: string
  site_code: string
  context_name_zh: string | null
  context_name_en: string | null
  context_original_code: string | null
  context_type_zh: string | null
  context_type_en: string | null
  period_zh: string | null
  period_en: string | null
  description_zh: string | null
  description_en: string | null
  note_zh: string | null
  note_en: string | null
}

export type CoinTypeHierarchyRow = {
  id: string
  level1_zh: string | null
  level1_en: string | null
  level2_zh: string | null
  level2_en: string | null
  level3_zh: string | null
  level3_en: string | null
  level4_zh: string | null
  level4_en: string | null
  level5_zh: string | null
  level5_en: string | null
  img_acc_num: string | null
  description_zh: string | null
  description_en: string | null
}

/**
 * Flattened view of a coin_issues row joined to mints/states/inscriptions/
 * coin_type_hierarchy — same shape as the old CoinType (for display call
 * sites that only read text) plus the FK ids (for matching call sites,
 * see lib/typology-filter.ts and lib/mint-filter.ts).
 *
 * `id` is the real join key — every match/lookup against `finds` should key
 * off this (via finds.coin_issues_id), never off `coin_type_code`. That's a
 * business/catalog code kept for display only (e.g. the "Code" column on
 * the coin-types detail page); `finds.coin_type_code` itself was renamed to
 * `deprecated_coin_type_code` and no longer exists under that name.
 */
export type CoinIssueDisplay = {
  id: string
  coin_type_code: string
  major_type_zh: string | null
  major_type_en: string | null
  minor_type_zh: string | null
  minor_type_en: string | null
  inscription: string | null
  inscription_en: string | null
  mint_zh: string | null
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
  description_zh: string | null
  description_en: string | null
  mint_id: string | null
  state_id: string | null
  inscription_id: string | null
  coin_type_hierarchy_id: string | null
}

export type Find = {
  id: string
  find_code: string
  context_code: string
  presence: boolean | null
  quantity_total: number | null
  quantity_min: number | null
  quantity_max: number | null
  quantity_estimated: number | null
  quantity_is_estimated: boolean | null
  total_weight_g: number | null
  quantity_note_zh: string | null
  description_zh: string | null
  description_en: string | null
  note_zh: string | null
  note_en: string | null
  coin_issues: CoinIssueDisplay | null
}

export type Source = {
  id: string
  source_code: string
  author_zh: string | null
  author_en: string | null
  title_zh: string | null
  title_en: string | null
  language: string | null
  year: number | null
  publication_zh: string | null
  publication_en: string | null
  page: string | null
  citation_zh: string | null
  citation_en: string | null
  url: string | null
  note_zh: string | null
  note_en: string | null
}

export type DatabaseStats = {
  siteCount: number
  totalCoins: number
  findCount: number
}

export type Mint = {
  id: string
  name_zh: string
  name_en: string | null
  precision_level: number | null
  latitude: number | null
  longitude: number | null
  description_zh: string | null
  description_en: string | null
  citation: string | null
  state_id: string | null
  modern_location_zh: string | null
  modern_location_en: string | null
  location_note: string | null
  /** FK ids into public.images, resolved to actual rows by lib/mint-directory.ts. */
  image_ids: string[]
  /** Raw citation strings from the dossier not yet linked to a public.sources
   * row — a manual-verification queue, not a finished bibliography. */
  sources_unlinked: string[]
  /** Stable /mints/[mint_code] URL slug — generated once (lib/admin/mints-actions.ts's
   * generateMintCode) and not meant to be hand-edited casually since it's load-bearing for routing. */
  mint_code: string
  /** Other names/spellings this mint is known by in older sources (e.g. 邯郸
   * was also inscribed as 甘丹) — a search/display cross-reference only.
   * coin_issues.mint_id / ans_data.mint_id are proper foreign keys, so
   * matching a find to a mint never depends on this field. */
  alternative_names: string[]
}

export type State = {
  id: string
  state_zh: string
  state_en: string | null
}

/** Flattened, display-ready mint info — the shape most consumers actually
 * want (a flat state_zh/state_en instead of a nested join, lat/lng instead
 * of latitude/longitude), built from a live `mints` row by
 * lib/mint-directory.ts's toMintInfo. Replaces the old static MintTown type
 * that used to come from lib/mint-towns.ts. */
export type MintInfo = {
  id: string
  mint_code: string
  name_zh: string
  name_en: string
  state_zh: string
  state_en: string
  modern_location_en: string
  modern_location_zh: string | null
  lat: number | null
  lng: number | null
  alternative_names: string[]
}

export type MintImage = {
  /** Public asset path, e.g. /images/mints/anyi-plan.png. */
  src: string
  caption?: string
  credit?: string
}

export type ImageRecord = {
  id: string
  /** Path relative to public/images/, e.g. "mints/anyi-plan.png". */
  filename: string
  source_id: string | null
  /** One-off credit/URL, used instead of source_id when the source isn't
   * worth cataloguing in public.sources. */
  source_text: string | null
  caption_zh: string | null
  caption_en: string | null
  note_zh: string | null
  note_en: string | null
  sources:
    | { citation_zh: string | null; citation_en: string | null; url: string | null }
    | { citation_zh: string | null; citation_en: string | null; url: string | null }[]
    | null
}

export type Inscription = {
  id: string
  inscription_zh: string | null
  inscription_en: string | null
}

export type SourceLink = {
  id: string
  source_link_code: string
  source_code: string
  target_type: 'site' | 'context' | 'find' | 'coin_item' | 'mint'
  target_code: string
  page: string | null
  note_zh: string | null
  note_en: string | null
}

export type HeatmapFind = {
  /** finds.coin_issues_id — the real FK to coin_issues.id. Match against
   * CoinIssueDisplay.id, never coin_type_code. */
  coin_issues_id: string | null
  quantity_total: number | null
  quantity_min: number | null
  quantity_estimated: number | null
  presence: boolean | null
  site_code: string
  context_code: string | null
}
