-- ============================================================================
-- Reconcile public.ans_data_upload -> public.ans_data, linked to coin_issues.
--
-- ans_data is fully derived from ans_data_upload + the reference tables, so
-- this script rebuilds it from scratch every run (drop + recreate) rather
-- than upserting -- there's no independent data living only in ans_data.
-- It also replaces only the 'ans_data:*' rows it previously wrote to
-- _check_errors, so re-running never touches error rows logged by other tools.
--
-- Whenever a specimen fully resolves (hierarchy/mint/state/inscription all
-- found, or legitimately absent -- i.e. nothing logged for it in
-- _check_errors) but no existing coin_issues row matches that combination,
-- this script also creates the missing coin_issues row and backfills
-- ans_data.issue_id to point at it, all in the same run (see steps 5-6). This
-- folds in what append-new-coin-issues.sql previously did as a separate
-- manual step; that script is still safe to run (it no-ops on combinations
-- already covered) but is no longer required for a full reconcile.
--
-- Each statement below is fully self-contained (no scratch/temp table shared
-- across statements), so it's safe to run top to bottom or one statement at
-- a time in the Supabase SQL editor.
-- ============================================================================

-- 1. Target table ---------------------------------------------------------
-- One row per ans_data_upload specimen. mint_id/state_id/inscription_id/
-- hierarchy_id are the resolved foreign keys (null when unresolved); issue_id
-- is filled in only when the resolved combination matches exactly one
-- existing coin_issues row.
drop table if exists public.ans_data cascade;

create table public.ans_data (
  id uuid primary key default gen_random_uuid(),
  upload_id bigint not null references public.ans_data_upload (id),
  issue_id uuid references public.coin_issues (id),
  catalog_number text,
  inscription_raw text,
  reverse_inscription text,
  hierarchy_id uuid references public.coin_type_hierarchy (id),
  mint_id uuid references public.mints (id),
  state_id uuid references public.states (id),
  inscription_id uuid references public.inscriptions (id),
  created_at timestamptz not null default now(),
  constraint ans_data_upload_id_key unique (upload_id)
);

create index if not exists ans_data_issue_id_idx on public.ans_data (issue_id);
create index if not exists ans_data_hierarchy_id_idx on public.ans_data (hierarchy_id);
-- Enforced at the DB level since step 4 below de-duplicates catalog_number
-- by appending b, c, ... to repeats; nulls are exempt (ans_data_upload rows
-- can legitimately have no catalog number).
create unique index if not exists ans_data_catalog_number_unique_idx
  on public.ans_data (catalog_number) where catalog_number is not null;

-- 2. Clear this script's previous error log ---------------------------------
delete from public._check_errors where failed_field like 'ans_data:%';

-- 3. Log every failed reconciliation dimension to _check_errors --------------
-- coin_type_code is NOT NULL on _check_errors; ans_data_upload.catalog_number
-- can itself be null, so fall back to the upload row id as the identifier.
--
-- A hierarchy match is logged as 'ans_data:coin_type' when coin_type_zh
-- matches nothing in coin_type_hierarchy, and 'ans_data:coin_type_ambiguous'
-- when it matches more than one row (e.g. the upload doesn't capture the
-- large/small split that coin_type_hierarchy does at level5) -- either way
-- hierarchy_id is left null since there's no single id to record.
insert into public._check_errors (coin_type_code, failed_field, raw_value)
with src as (
  select
    id as upload_id,
    catalog_number,
    coin_type_zh,
    nullif(trim(inscription), '') as inscription,
    nullif(trim(state_zh), '') as state_zh,
    nullif(trim(mint_zh), '') as mint_zh
  from public.ans_data_upload
),
resolved_mint as (
  select
    s.upload_id,
    (s.mint_zh is not null and not exists (
      select 1 from public.mints m where m.name_zh = s.mint_zh
    )) as mint_failed
  from src s
),
resolved_state as (
  select
    s.upload_id,
    (s.state_zh is not null and not exists (
      select 1 from public.states st where st.state_zh = s.state_zh
    )) as state_failed
  from src s
),
resolved_inscription as (
  select
    s.upload_id,
    (s.inscription is not null and not exists (
      select 1 from public.inscriptions i where i.inscription_zh = s.inscription
    )) as inscription_failed
  from src s
),
resolved_hierarchy as (
  select
    s.upload_id,
    array_agg(distinct h.id order by h.id) filter (where h.id is not null) as hierarchy_candidates
  from src s
  left join public.coin_type_hierarchy h
    on s.coin_type_zh = coalesce(h.level5_zh, h.level4_zh, h.level3_zh, h.level2_zh)
  group by s.upload_id
)
select coalesce(s.catalog_number, 'upload_id:' || s.upload_id::text), 'ans_data:mint', s.mint_zh
  from src s join resolved_mint rm on rm.upload_id = s.upload_id where rm.mint_failed
union all
select coalesce(s.catalog_number, 'upload_id:' || s.upload_id::text), 'ans_data:state', s.state_zh
  from src s join resolved_state rs on rs.upload_id = s.upload_id where rs.state_failed
union all
select coalesce(s.catalog_number, 'upload_id:' || s.upload_id::text), 'ans_data:inscription', s.inscription
  from src s join resolved_inscription ri on ri.upload_id = s.upload_id where ri.inscription_failed
union all
select coalesce(s.catalog_number, 'upload_id:' || s.upload_id::text), 'ans_data:coin_type', s.coin_type_zh
  from src s join resolved_hierarchy rh on rh.upload_id = s.upload_id where rh.hierarchy_candidates is null
union all
select
  coalesce(s.catalog_number, 'upload_id:' || s.upload_id::text),
  'ans_data:coin_type_ambiguous',
  s.coin_type_zh || ' (' || array_length(rh.hierarchy_candidates, 1) || ' hierarchy candidates)'
  from src s join resolved_hierarchy rh on rh.upload_id = s.upload_id
  where array_length(rh.hierarchy_candidates, 1) > 1;

-- 4. Populate ans_data --------------------------------------------------------
insert into public.ans_data (
  upload_id, issue_id, catalog_number, inscription_raw, reverse_inscription,
  hierarchy_id, mint_id, state_id, inscription_id
)
with src as (
  select
    id as upload_id,
    catalog_number,
    coin_type_zh,
    inscription_raw,
    nullif(trim(inscription), '') as inscription,
    nullif(trim(reverse_inscription), '') as reverse_inscription,
    nullif(trim(state_zh), '') as state_zh,
    nullif(trim(mint_zh), '') as mint_zh
  from public.ans_data_upload
),
resolved_mint as (
  select
    s.upload_id,
    (select m.id from public.mints m where m.name_zh = s.mint_zh) as mint_id,
    (s.mint_zh is not null and not exists (
      select 1 from public.mints m where m.name_zh = s.mint_zh
    )) as mint_failed
  from src s
),
resolved_state as (
  select
    s.upload_id,
    (select st.id from public.states st where st.state_zh = s.state_zh) as state_id,
    (s.state_zh is not null and not exists (
      select 1 from public.states st where st.state_zh = s.state_zh
    )) as state_failed
  from src s
),
resolved_inscription as (
  select
    s.upload_id,
    -- inscription_zh has a couple of duplicate labels in the reference table;
    -- pick the lowest id deterministically rather than fanning out the join.
    (select i.id from public.inscriptions i where i.inscription_zh = s.inscription
       order by i.id limit 1) as inscription_id,
    (s.inscription is not null and not exists (
      select 1 from public.inscriptions i where i.inscription_zh = s.inscription
    )) as inscription_failed
  from src s
),
resolved_hierarchy as (
  select
    s.upload_id,
    array_agg(distinct h.id order by h.id) filter (where h.id is not null) as hierarchy_candidates
  from src s
  left join public.coin_type_hierarchy h
    on s.coin_type_zh = coalesce(h.level5_zh, h.level4_zh, h.level3_zh, h.level2_zh)
  group by s.upload_id
),
-- catalog_number as uploaded is not guaranteed unique (e.g. multiple
-- specimens recorded under the same museum number). dup_rank numbers each
-- repeat of a given catalog_number, ordered by upload_id for a stable,
-- reproducible assignment across re-runs; the first occurrence is rank 1.
-- Assumes fewer than 26 rows share any single catalog_number (b..z) -- true
-- of this dataset today.
catalog_numbering as (
  select
    s.upload_id,
    row_number() over (partition by s.catalog_number order by s.upload_id) as dup_rank
  from src s
  where s.catalog_number is not null
),
resolved as (
  select
    s.*,
    rm.mint_id, rm.mint_failed,
    rs.state_id, rs.state_failed,
    ri.inscription_id, ri.inscription_failed,
    case when array_length(rh.hierarchy_candidates, 1) = 1 then rh.hierarchy_candidates[1] else null end as hierarchy_id,
    (
      rm.mint_failed is not true
      and rs.state_failed is not true
      and ri.inscription_failed is not true
      and array_length(rh.hierarchy_candidates, 1) = 1
    ) as can_match
  from src s
  join resolved_mint rm on rm.upload_id = s.upload_id
  join resolved_state rs on rs.upload_id = s.upload_id
  join resolved_inscription ri on ri.upload_id = s.upload_id
  join resolved_hierarchy rh on rh.upload_id = s.upload_id
),
coin_issue_matches as (
  select
    r.upload_id,
    array_agg(distinct ci.id order by ci.id) as matched_issue_ids
  from resolved r
  join public.coin_issues ci
    on r.can_match
    and ci.coin_type_hierarchy_id = r.hierarchy_id
    and ci.mint_id is not distinct from r.mint_id
    and ci.state_id is not distinct from r.state_id
    and ci.inscription_id is not distinct from r.inscription_id
    and ci.reverse_inscription is not distinct from r.reverse_inscription
  group by r.upload_id
)
select
  r.upload_id,
  case
    when cim.matched_issue_ids is not null and array_length(cim.matched_issue_ids, 1) = 1
      then cim.matched_issue_ids[1]
    else null
  end as issue_id,
  case
    when cn.dup_rank is null or cn.dup_rank = 1 then r.catalog_number
    else r.catalog_number || chr(96 + cn.dup_rank::int)
  end as catalog_number,
  r.inscription_raw,
  r.reverse_inscription,
  r.hierarchy_id,
  r.mint_id,
  r.state_id,
  r.inscription_id
from resolved r
left join coin_issue_matches cim on cim.upload_id = r.upload_id
left join catalog_numbering cn on cn.upload_id = r.upload_id;

-- 5. Create coin_issues rows for newly-seen combinations -------------------
-- Candidates: ans_data rows that came out of step 4 with issue_id still null
-- but hierarchy_id resolved -- i.e. the coin type itself is known and
-- mint/state/inscription resolved cleanly (or were legitimately absent), so
-- nothing was logged to _check_errors for this row; there's just no catalog
-- entry yet for this exact mint/state/inscription/type combination.
--
-- coin_type_code is assigned sequentially after the highest existing
-- 'CT_ANS_%' code. description_zh/description_en are auto-assembled from the
-- hierarchy label and inscription -- a starting point, not a final
-- catalogue description; review and edit them in coin_issues afterward.
--
-- Re-runnable: a combination already present in coin_issues (matched on
-- hierarchy/mint/state/inscription/reverse_inscription) is never re-inserted.
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

-- 6. Backfill ans_data.issue_id for the coin_issues rows just created -------
-- Same matching rule as step 4 (hierarchy/mint/state/inscription/
-- reverse_inscription, all compared with IS NOT DISTINCT FROM so nulls
-- match nulls), re-applied only to rows step 4 left unmatched. Guarded by
-- match_count = 1 so a specimen is only linked when exactly one coin_issues
-- row fits -- if step 5's insert somehow left more than one candidate
-- matching the same combination, this leaves issue_id null rather than
-- picking one arbitrarily.
update public.ans_data ad
set issue_id = m.matched_issue_id
from (
  select
    ad2.id as ans_data_id,
    (array_agg(distinct ci.id order by ci.id))[1] as matched_issue_id,
    count(distinct ci.id) as match_count
  from public.ans_data ad2
  join public.coin_issues ci
    on ci.coin_type_hierarchy_id = ad2.hierarchy_id
    and ci.mint_id is not distinct from ad2.mint_id
    and ci.state_id is not distinct from ad2.state_id
    and ci.inscription_id is not distinct from ad2.inscription_id
    and ci.reverse_inscription is not distinct from ad2.reverse_inscription
  where ad2.issue_id is null
    and ad2.hierarchy_id is not null
  group by ad2.id
) m
where ad.id = m.ans_data_id
  and m.match_count = 1;

-- ============================================================================
-- Quick sanity checks to run after the script above:
--
-- select count(*) from public.ans_data;
-- select count(*) from public.ans_data where issue_id is not null;
-- select count(*) from public.ans_data where hierarchy_id is not null and issue_id is null;
--   (should be 0 after step 6, unless step 6's match_count guard caught a
--   genuine coin_issues duplicate -- worth investigating if nonzero)
-- select failed_field, count(*) from public._check_errors
--   where failed_field like 'ans_data:%' group by 1 order by 2 desc;
-- select * from public.coin_issues where coin_type_code like 'CT_ANS_%' order by coin_type_code;
-- select catalog_number, count(*) from public.ans_data
--   where catalog_number is not null group by 1 having count(*) > 1;
--   (should always be empty -- step 4's dup_rank suffixing plus the unique
--   index in step 1 both enforce this)
-- ============================================================================
