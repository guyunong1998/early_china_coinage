-- Applied. inscription_id dropped: public.inscriptions.inscription_zh is now
-- NOT NULL + UNIQUE (the one duplicate "中邑" row was merged, two orphaned
-- null rows deleted -- see conversation), so inscription_zh alone is a safe,
-- stable match key for exact-match inscription filtering in
-- lib/typology-filter.ts. hierarchy_id was already dropped in favor of the
-- inlined level1..level5 columns below.
--
-- Flattens ans_data + its mints/states/inscriptions/coin_type_hierarchy
-- joins (currently done via embedded selects + a one()-unwrap step in
-- lib/ans-museum-data.ts's getAnsSpecimens) into a single view, mirroring
-- how v_coin_issues_flat (add-flat-views.sql) already flattens coin_issues'
-- equivalent joins. Note: like the other views in this repo, this only
-- flattens the join -- it does NOT reduce row count, since
-- /museum-collections ships every specimen to the client for in-browser
-- filtering (see Q5's "shipped raw" note). If cutting ans_data egress is the
-- actual goal here rather than just removing the client-side join code,
-- that needs either a scoped fetch or the CSV/snapshot approach from Q5d,
-- not this view on its own.
--
-- security_invoker = true for the same reason as every other view in this
-- repo -- runs under the querying role's own RLS, not the view owner's.
--
-- Run by hand in the Supabase SQL editor once reviewed -- this repo's
-- existing scripts/*.sql convention, no migration runner.
create or replace view public.v_ans_flat
with (security_invoker = true) as
select
  a.id,
  a.catalog_number,
  cth.level1_zh,
  cth.level1_en,
  cth.level2_zh,
  cth.level2_en,
  cth.level3_zh,
  cth.level3_en,
  cth.level4_zh,
  cth.level4_en,
  cth.level5_zh,
  cth.level5_en,
  insc.inscription_zh,
  insc.inscription_en,
  m.name_zh as mint_zh,
  m.name_en as mint_en,
  st.state_zh,
  st.state_en
from public.ans_data a
left join public.coin_type_hierarchy cth on cth.id = a.hierarchy_id
left join public.inscriptions insc on insc.id = a.inscription_id
left join public.mints m on m.id = a.mint_id
left join public.states st on st.id = a.state_id;

grant select on public.v_ans_flat to anon, authenticated;
