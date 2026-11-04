-- Aggregating view for the Mint Town overview (/mints, via
-- components/mints/MintsPageContent.tsx). Replaces pulling the entire
-- `finds` table and `coin_issues` catalogue down to the app just to compute
-- per-mint counts and type tags in JS. Read by lib/queries.ts's getMintStats
-- and turned into MintStat rows by lib/mint-stats.ts's
-- computeMintStatsFromView.
--
-- Mirrors lib/mint-stats.ts's computeMintStatsFromFinds exactly (verified
-- against live data: identical find/coin/site counts and inscription sets
-- for all 126 mints):
-- - coin_count sums coalesce(quantity_total, quantity_estimated,
--   quantity_min, 0), the same fallback order as lib/quantity.ts's
--   findQuantity().
-- - finds join contexts as an inner join, like getFindsForHeatmap's
--   `contexts!inner(site_code)`.
-- - inscriptions only come from issues that actually have finds (the JS
--   collects them per find, not per catalogued issue).
-- - every mint gets a row, zero-count ones included.
--
-- issue_count / type_labels replace the /mints list's old in-JS catalogue
-- pass over getCoinIssues() (verified identical on live data before it was
-- removed): issue_count is every coin_issues row at the mint, finds or not;
-- type_labels is `minor_type ?? major_type` from v_coin_issues_flat, deduped
-- by zh, with the English label taken from the first issue by
-- coin_type_code. Label order isn't guaranteed; the app sorts zh-CN itself.
--
-- Each aggregate is grouped in its own subquery so finds rows don't multiply
-- issue counts (and vice versa).
--
-- Name/state/coordinates are deliberately left out: the /mints page already
-- fetches the full `mints` rows for its directory list, and joins on mint_id.
--
-- `security_invoker = true` for the same reason as the views in
-- add-flat-views.sql: runs under the querying role's own RLS rather than the
-- view owner's, so it doesn't silently bypass a future RLS change.
--
-- Run by hand in the Supabase SQL editor -- this repo has no migration
-- runner, scripts/*.sql is the existing convention (see add-flat-views.sql).
create or replace view public.v_mint_stats
with (security_invoker = true) as
select
  m.id as mint_id,
  m.mint_code,
  coalesce(fs.find_count, 0) as find_count,
  coalesce(fs.coin_count, 0) as coin_count,
  coalesce(fs.site_count, 0) as site_count,
  coalesce(fs.inscriptions, '{}') as inscriptions,
  coalesce(ic.issue_count, 0) as issue_count,
  coalesce(tl.type_labels, '[]'::jsonb) as type_labels
from public.mints m
left join (
  select
    ci.mint_id,
    count(f.id) as find_count,
    sum(coalesce(f.quantity_total, f.quantity_estimated, f.quantity_min, 0)) as coin_count,
    count(distinct ctx.site_code) as site_count,
    coalesce(array_agg(distinct btrim(ins.inscription_zh)) filter (where btrim(ins.inscription_zh) <> ''), '{}') as inscriptions
  from public.coin_issues ci
  join public.finds f on f.coin_issues_id = ci.id
  join public.contexts ctx on ctx.context_code = f.context_code
  left join public.inscriptions ins on ins.id = ci.inscription_id
  group by ci.mint_id
) fs on fs.mint_id = m.id
left join (
  select mint_id, count(*) as issue_count
  from public.coin_issues
  group by mint_id
) ic on ic.mint_id = m.id
left join (
  select mint_id, jsonb_agg(jsonb_build_object('zh', zh, 'en', en)) as type_labels
  from (
    select mint_id, zh, (array_agg(en order by coin_type_code))[1] as en
    from (
      select
        mint_id,
        coalesce(minor_type_zh, major_type_zh) as zh,
        case when minor_type_zh is not null then minor_type_en else major_type_en end as en,
        coin_type_code
      from public.v_coin_issues_flat
    ) labels
    where zh <> ''
    group by mint_id, zh
  ) deduped
  group by mint_id
) tl on tl.mint_id = m.id;

grant select on public.v_mint_stats to anon, authenticated;
