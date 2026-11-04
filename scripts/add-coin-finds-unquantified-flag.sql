-- Adds `unquantified` to v_coin_finds: true when a find has no
-- quantity_total/quantity_estimated/quantity_min recorded at all (a find
-- known to be present, just never counted) -- distinct from a genuine
-- recorded quantity of zero. `quantity_for_map` already defaults an
-- unquantified find to 1 for map-dot sizing (coalesce(..., 1)); this column
-- lets a caller that instead wants to treat an unquantified find as 0
-- (lib/coin-type-catalog.ts's computeCoinTypeCounts convention, used for the
-- "Coins & sites" stat) tell the two cases apart without re-deriving it from
-- raw quantity_total/estimated/min each time.
--
-- Documented here per the mint-town owner's request, but NOT wired into any
-- query or filter yet -- purely an available column for now.
--
-- CREATE OR REPLACE VIEW, not drop+recreate, since no column is removed or
-- retyped -- just one new trailing column. v_coin_map_sites joins `finds`
-- directly (not through this view -- see scripts/remake-v-coin-finds.sql) so
-- it's unaffected.
--
-- Run by hand in the Supabase SQL editor -- this repo has no migration
-- runner, scripts/*.sql is the existing convention. Idempotent: safe to
-- re-run.

create or replace view public.v_coin_finds
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
  coalesce(f.quantity_total, f.quantity_estimated, f.quantity_min, 1) as quantity_for_map,
  (f.quantity_total is null and f.quantity_estimated is null and f.quantity_min is null) as unquantified
from public.finds f
left join public.contexts c on c.context_code = f.context_code
left join public.coin_issues ci on ci.id = f.coin_issues_id
left join public.coin_type_hierarchy cth on cth.id = ci.coin_type_hierarchy_id
left join public.inscriptions ins on ins.id = ci.inscription_id
left join public.states st on st.id = ci.state_id
left join public.mints m on m.id = ci.mint_id;

grant select on public.v_coin_finds to anon, authenticated;
