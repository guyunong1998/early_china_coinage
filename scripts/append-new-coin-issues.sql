-- ============================================================================
-- Pull unresolved specimens out of public.ans_data and insert them as brand
-- new public.coin_issues rows.
--
-- Candidates: ans_data rows with issue_id null (no existing coin_issues row
-- matched) but hierarchy_id not null (the coin type itself is known -- we
-- just don't have a catalog entry for this mint/state/inscription/type
-- combination yet). Rows where hierarchy_id is null (coin_type didn't
-- resolve, or was ambiguous -- see _check_errors) are skipped; fix those in
-- ans_data_upload and re-run reconcile-ans-data.sql first.
--
-- Re-runnable: a combination already present in coin_issues (matched on
-- hierarchy/mint/state/inscription/reverse_inscription) is never re-inserted,
-- so running this after reconcile-ans-data.sql has picked up the newly
-- created issues is safe.
--
-- description_zh/description_en are auto-assembled from the hierarchy label
-- and inscription -- review and edit them in coin_issues after running this;
-- they're a starting point, not a final catalogue description.
--
-- Recommended workflow:
--   1. run reconcile-ans-data.sql
--   2. review public.ans_data where issue_id is null and hierarchy_id is not null
--   3. run this script
--   4. re-run reconcile-ans-data.sql so ans_data.issue_id picks up the new rows
-- ============================================================================

insert into public.coin_issues (
  coin_type_code, description_zh, description_en,
  mint_id, state_id, inscription_id, coin_type_hierarchy_id, reverse_inscription
)
with candidates as (
  select distinct
    ad.hierarchy_id,
    ad.mint_id,
    ad.state_id,
    ad.inscription_id,
    ad.reverse_inscription
  from public.ans_data ad
  where ad.issue_id is null
    and ad.hierarchy_id is not null
    and not exists (
      select 1 from public.coin_issues ci
      where ci.coin_type_hierarchy_id = ad.hierarchy_id
        and ci.mint_id is not distinct from ad.mint_id
        and ci.state_id is not distinct from ad.state_id
        and ci.inscription_id is not distinct from ad.inscription_id
        and ci.reverse_inscription is not distinct from ad.reverse_inscription
    )
),
next_seq as (
  select coalesce(max(substring(coin_type_code from 'CT_ANS_(\d+)')::int), 0) as start_n
  from public.coin_issues
  where coin_type_code like 'CT_ANS_%'
),
numbered as (
  select
    c.*,
    row_number() over (order by c.hierarchy_id, c.mint_id, c.state_id, c.inscription_id) as rn
  from candidates c
)
select
  'CT_ANS_' || lpad((next_seq.start_n + numbered.rn)::text, 4, '0'),
  coalesce(h.level5_zh, h.level4_zh, h.level3_zh)
    || case when i.inscription_zh is not null then '，铭文：' || i.inscription_zh else '' end,
  coalesce(h.level5_en, h.level4_en, h.level3_en)
    || case when i.inscription_en is not null
         then ', inscribed "' || i.inscription_zh || '" (' || i.inscription_en || ')'
         else '' end,
  numbered.mint_id,
  numbered.state_id,
  numbered.inscription_id,
  numbered.hierarchy_id,
  numbered.reverse_inscription
from numbered, next_seq
join public.coin_type_hierarchy h on h.id = numbered.hierarchy_id
left join public.inscriptions i on i.id = numbered.inscription_id;

-- ============================================================================
-- Quick sanity checks to run after the script above:
--
-- select * from public.coin_issues where coin_type_code like 'CT_ANS_%' order by coin_type_code;
-- select count(*) from public.ans_data where issue_id is null and hierarchy_id is not null;
--   (re-run reconcile-ans-data.sql -- this count should drop to 0 once it does)
-- ============================================================================
