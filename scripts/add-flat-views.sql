-- Two read-only views that push per-row joins currently done in application
-- code (lib/queries.ts's flattenCoinIssue, lib/admin/resolve-source-link-target.ts)
-- down into Postgres. Both are `security_invoker = true` so they run under the
-- querying role's own RLS, not the view owner's -- doesn't change behavior
-- today (every underlying table already grants plain SELECT to anon/
-- authenticated with no restrictive read policies), but it's the correct
-- default so a future RLS change on any base table is inherited automatically
-- instead of silently bypassed by the view.
--
-- Run by hand in the Supabase SQL editor (matches this project's existing
-- scripts/*.sql convention -- there is no in-repo migration runner).

-- ── v_coin_issues_flat ──────────────────────────────────────────────────
-- Mirrors lib/queries.ts's COIN_ISSUE_FIELDS + flattenCoinIssue()/
-- deriveMajorMinor(): coin_issues joined to mints/states/inscriptions/
-- coin_type_hierarchy, flattened into the same flat zh/en shape
-- CoinIssueDisplay expects. Once this exists, callers can `select *` here
-- instead of repeating the four-table join + JS flatten step.
create or replace view public.v_coin_issues_flat
with (security_invoker = true) as
select
  ci.id,
  ci.coin_type_code,
  case when cth.level1_zh = '钱币' then cth.level2_zh else cth.level1_zh end as major_type_zh,
  case when cth.level1_zh = '钱币' then cth.level2_en else cth.level1_en end as major_type_en,
  case
    when cth.level1_zh = '钱币' then coalesce(cth.level5_zh, cth.level4_zh, cth.level3_zh)
    else coalesce(cth.level5_zh, cth.level4_zh, cth.level3_zh, cth.level2_zh)
  end as minor_type_zh,
  case
    when cth.level1_zh = '钱币' then coalesce(cth.level5_en, cth.level4_en, cth.level3_en)
    else coalesce(cth.level5_en, cth.level4_en, cth.level3_en, cth.level2_en)
  end as minor_type_en,
  cth.level2_zh,
  cth.level2_en,
  insc.inscription_zh as inscription,
  insc.inscription_en,
  m.name_zh as mint_zh,
  m.name_en as mint_en,
  st.state_zh,
  st.state_en,
  ci.description_zh,
  ci.description_en,
  ci.mint_id,
  ci.state_id,
  ci.inscription_id,
  ci.coin_type_hierarchy_id
from public.coin_issues ci
left join public.mints m on m.id = ci.mint_id
left join public.states st on st.id = ci.state_id
left join public.inscriptions insc on insc.id = ci.inscription_id
left join public.coin_type_hierarchy cth on cth.id = ci.coin_type_hierarchy_id;

grant select on public.v_coin_issues_flat to anon, authenticated;

-- ── v_source_link_targets ───────────────────────────────────────────────
-- Mirrors lib/admin/resolve-source-link-target.ts's resolveSourceLinkTargets():
-- resolves a source_links row's (target_type, target_code) to a display
-- label + the one public href that target type can link to, by walking the
-- same site/context/find/coin_item/mint chain the JS version batches
-- through by hand. target_code isn't a real FK (the target table varies by
-- target_type), so callers should LEFT JOIN this view on
-- (target_type, target_code) and treat a null match the same way the app
-- already does -- render it as plain muted text, not a broken link.
--
-- Inner joins below (not left joins) are deliberate: a find/coin_item whose
-- context/find chain doesn't resolve to a site shouldn't produce a row with
-- a broken href, mirroring the `!inner` embeds resolveSourceLinkTargets uses.
create or replace view public.v_source_link_targets
with (security_invoker = true) as
select
  'site'::text as target_type,
  s.site_code as target_code,
  case when s.site_name_zh is not null then s.site_code || ' · ' || s.site_name_zh else s.site_code end as label,
  '/sites/' || s.site_code as href
from public.sites s

union all

select
  'context'::text,
  c.context_code,
  case when c.context_name_zh is not null then c.context_code || ' · ' || c.context_name_zh else c.context_code end,
  '/sites/' || c.site_code
from public.contexts c

union all

select
  'find'::text,
  f.find_code,
  f.find_code,
  '/sites/' || ctx.site_code
from public.finds f
join public.contexts ctx on ctx.context_code = f.context_code

union all

select
  'coin_item'::text,
  ci.coin_item_code,
  case when ci.description_zh is not null then ci.coin_item_code || ' · ' || ci.description_zh else ci.coin_item_code end,
  '/sites/' || ctx.site_code
from public.coin_items ci
join public.finds f on f.find_code = ci.find_code
join public.contexts ctx on ctx.context_code = f.context_code

union all

select
  'mint'::text,
  m.mint_code,
  case when m.name_zh is not null then m.mint_code || ' · ' || m.name_zh else m.mint_code end,
  '/mints/' || m.mint_code
from public.mints m;

grant select on public.v_source_link_targets to anon, authenticated;
