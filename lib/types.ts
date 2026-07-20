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
  inscriptions: string | null
  states_zh: string | null
  mints_zh: string | null
}

export type Site = MapSite & {
  id: string
  period_zh: string | null
  period_en: string | null
  description_zh: string | null
  description_en: string | null
  source_code: string | null
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
  source_code: string | null
  note_zh: string | null
  note_en: string | null
}

export type CoinType = {
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
}

/**
 * Flattened view of a coin_issues row joined to mints/states/inscriptions/
 * coin_type_hierarchy — same shape as the old CoinType (for display call
 * sites that only read text) plus the FK ids (for matching call sites,
 * see lib/typology-filter.ts and lib/mint-filter.ts).
 */
export type CoinIssueDisplay = {
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
  coin_type_code: string | null
  source_code: string | null
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
  coin_issues: CoinIssueDisplay | null
}

export type Source = {
  source_code: string
  author_zh: string | null
  author_en: string | null
  title_zh: string | null
  title_en: string | null
  year: number | null
  publication_zh: string | null
  page: string | null
  citation_zh: string | null
  url: string | null
}

export type DatabaseStats = {
  siteCount: number
  totalCoins: number
  findCount: number
}

export type HeatmapFind = {
  coin_type_code: string | null
  quantity_total: number | null
  quantity_min: number | null
  quantity_estimated: number | null
  presence: boolean | null
  site_code: string
  context_code: string | null
}
