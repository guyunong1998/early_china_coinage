-- Adds description_zh/en and period_zh/en to v_coin_map_sites.
--
-- getAllSites() (/search) used to page through the whole `sites` table a
-- second time (attachSiteDetails) just to pick up these four columns, on
-- top of its full v_coin_map_sites scan. With them on the view, that second
-- full scan is gone. Every other v_coin_map_sites consumer selects an
-- explicit column list (MAP_SITE_FIELDS), so their payloads are unchanged.
--
-- New columns are appended at the end, so this is a CREATE OR REPLACE (no
-- drop): existing grants and sum_total_quantity_for_map() are untouched.
-- Grouping on the extra columns can't split rows -- sites.site_code is
-- unique and periods is a to-one join.
--
-- Body otherwise identical to scripts/trim-v-coin-map-sites-location-detail.sql.
-- Run by hand in the Supabase SQL editor -- this repo has no migration
-- runner, scripts/*.sql is the existing convention.

create or replace view public.v_coin_map_sites
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
  string_agg(distinct m.name_en, '、') as mints_en,
  s.description_zh,
  s.description_en,
  p.period_zh,
  p.period_en
from public.sites s
left join public.periods p on p.id = s.period_id
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
  s.precision_level, s.site_type_zh, s.site_type_en,
  s.description_zh, s.description_en, p.period_zh, p.period_en;
