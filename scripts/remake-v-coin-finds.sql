-- Remakes v_coin_finds as a slim per-find view: one row per find_code, with
-- context/site codes, the coin issue id, and the coin type / inscription /
-- state / mint each as (id, zh, en) -- plus quantity_for_map.
--
-- "coin type" here is coin_type_hierarchy's own name_zh/name_en (the
-- specific node name, e.g. "耸肩空首布" / "Pointed-Shoulder Hollow-Socket
-- Spade"), not the level1-5 breadcrumb -- same field used elsewhere in the
-- app (lib/queries.ts) as a coin issue's type name.
--
-- v_coin_map_sites depended on the old (wide) v_coin_finds for site detail
-- columns (site_name/province/lat/lng/etc) and the level1-5 type breakdown
-- that this slim view no longer carries, so it's rewritten here to join
-- sites/contexts/coin_issues/coin_type_hierarchy/inscriptions/states/mints
-- directly instead. Its own output columns and aggregation are unchanged;
-- only its FROM/JOIN source changed. sum_total_quantity_for_map()
-- (add-sum-total-quantity-function.sql) reads total_quantity_for_map from
-- v_coin_map_sites by name, so it keeps working unmodified.
--
-- security_invoker = true on both, per this repo's view convention (runs
-- under the querying role's own RLS rather than the view owner's).
--
-- Run by hand in the Supabase SQL editor -- this repo has no migration
-- runner, scripts/*.sql is the existing convention.

drop view if exists public.v_coin_map_sites;
drop view if exists public.v_coin_finds;

create view public.v_coin_finds
with (security_invoker = true) as
select
  f.find_code,
  f.context_code,
  c.site_code,
  ci.id as coin_issues_id,
  cth.id as coin_type_id,
  cth.name_zh as coin_type_zh,
  cth.name_en as coin_type_en,
  ins.id as inscription_id,
  ins.inscription_zh,
  ins.inscription_en,
  st.id as state_id,
  st.state_zh,
  st.state_en,
  m.id as mint_id,
  m.name_zh as mint_zh,
  m.name_en as mint_en,
  coalesce(f.quantity_total, f.quantity_estimated, f.quantity_min, 1) as quantity_for_map
from public.finds f
left join public.contexts c on c.context_code = f.context_code
left join public.coin_issues ci on ci.id = f.coin_issues_id
left join public.coin_type_hierarchy cth on cth.id = ci.coin_type_hierarchy_id
left join public.inscriptions ins on ins.id = ci.inscription_id
left join public.states st on st.id = ci.state_id
left join public.mints m on m.id = ci.mint_id;

grant select on public.v_coin_finds to anon, authenticated;

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
  s.location_detail_zh,
  s.location_detail_en,
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
  s.city_zh, s.city_en, s.county_zh, s.county_en, s.location_detail_zh,
  s.location_detail_en, s.lat, s.lng, s.precision_level, s.site_type_zh,
  s.site_type_en;

grant select on public.v_coin_map_sites to anon, authenticated;
