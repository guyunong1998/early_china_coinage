-- Drops location_detail_zh/location_detail_en from v_coin_map_sites.
--
-- Traced every consumer of MAP_SITE_FIELDS/MapSite (search page, search
-- filters, map popups, site detail page, coin-type detail page, mint issue
-- distribution) and confirmed these two are the only columns on the view
-- that are fetched but never actually read anywhere: SiteDetailContent's
-- own location-detail row is sourced from the raw `sites` table (getSite()),
-- not this view's `summary`. All other seemingly-redundant _en aggregate
-- columns (level1-5_types_en, inscriptions_en, states_en, mints_en) turned
-- out to be load-bearing -- lib/queries.ts's filterSitesByQuery() matches
-- English /search queries directly against them, and
-- fillMissingMapSiteTypes()'s union logic keeps them in lockstep with their
-- zh counterparts -- so those stay.
--
-- CREATE OR REPLACE VIEW can't drop columns (errors 42P16), so this is a
-- drop + recreate. No other view depends on v_coin_map_sites, and
-- sum_total_quantity_for_map() (add-sum-total-quantity-function.sql) only
-- reads total_quantity_for_map by name, so it's unaffected.
--
-- security_invoker = true per this repo's view convention.
--
-- Run by hand in the Supabase SQL editor -- this repo has no migration
-- runner, scripts/*.sql is the existing convention.

drop view public.v_coin_map_sites;

create view public.v_coin_map_sites
with (security_invoker = true) as
select
  s.site_code,
  s.site_name_zh,
  s.site_name_en,
  s.province_zh,
  s.province_en,
  s.city_zh,
  s.city_en,
  s.county_zh,
  s.county_en,
  s.lat,
  s.lng,
  s.precision_level,
  s.site_type_zh,
  s.site_type_en,
  count(f.find_code) as find_record_count,
  sum(coalesce(f.quantity_total, f.quantity_estimated, f.quantity_min, 1)) as total_quantity_for_map,
  string_agg(distinct cth.level1_zh, '、') as level1_types_zh,
  string_agg(distinct cth.level2_zh, '、') as level2_types_zh,
  string_agg(distinct cth.level3_zh, '、') as level3_types_zh,
  string_agg(distinct cth.level4_zh, '、') as level4_types_zh,
  string_agg(distinct cth.level5_zh, '、') as level5_types_zh,
  string_agg(distinct ins.inscription_zh, '、') as inscriptions,
  string_agg(distinct st.state_zh, '、') as states_zh,
  string_agg(distinct m.name_zh, '、') as mints_zh,
  string_agg(distinct cth.level1_en, '、') as level1_types_en,
  string_agg(distinct cth.level2_en, '、') as level2_types_en,
  string_agg(distinct cth.level3_en, '、') as level3_types_en,
  string_agg(distinct cth.level4_en, '、') as level4_types_en,
  string_agg(distinct cth.level5_en, '、') as level5_types_en,
  string_agg(distinct ins.inscription_en, '、') as inscriptions_en,
  string_agg(distinct st.state_en, '、') as states_en,
  string_agg(distinct m.name_en, '、') as mints_en
from public.sites s
join public.contexts c on c.site_code = s.site_code
join public.finds f on f.context_code = c.context_code
left join public.coin_issues ci on ci.id = f.coin_issues_id
left join public.coin_type_hierarchy cth on cth.id = ci.coin_type_hierarchy_id
left join public.inscriptions ins on ins.id = ci.inscription_id
left join public.states st on st.id = ci.state_id
left join public.mints m on m.id = ci.mint_id
where s.lat is not null and s.lng is not null
group by
  s.site_code, s.site_name_zh, s.site_name_en, s.province_zh, s.province_en,
  s.city_zh, s.city_en, s.county_zh, s.county_en, s.lat, s.lng,
  s.precision_level, s.site_type_zh, s.site_type_en;

grant select on public.v_coin_map_sites to anon, authenticated;
