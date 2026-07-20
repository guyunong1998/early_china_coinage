-- ============================================================================
-- Reconcile public.ans_data_upload -> public.ans_data, linked to coin_issues.
--
-- ans_data is fully derived from ans_data_upload + the reference tables, so
-- this script rebuilds it from scratch every run (drop + recreate) rather
-- than upserting -- there's no independent data living only in ans_data.
-- It also replaces only the 'ans_data:*' rows it previously wrote to
-- _check_errors, so re-running never touches error rows logged by other tools.
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

-- 2. Clear this script's previous error log ---------------------------------
delete from public._check_errors where failed_field like 'ans_data:%';

-- 3. Log every failed reconciliation dimension to _check_errors --------------
-- _check_errors.coin_type_code is a free-text row identifier shared across
-- error-logging tools (see also 'upload_reconciliation:*' rows written
-- elsewhere) -- despite the name, it does not reference coin_issues or any
-- coin type in any way. It's NOT NULL, and ans_data_upload.catalog_number can
-- itself be null, so we fall back to the upload row id as the identifier.
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
  r.catalog_number,
  r.inscription_raw,
  r.reverse_inscription,
  r.hierarchy_id,
  r.mint_id,
  r.state_id,
  r.inscription_id
from resolved r
left join coin_issue_matches cim on cim.upload_id = r.upload_id;

-- ============================================================================
-- Quick sanity checks to run after the script above:
--
-- select count(*) from public.ans_data;
-- select count(*) from public.ans_data where issue_id is not null;
-- select count(*) from public.ans_data where hierarchy_id is not null and issue_id is null;
-- select failed_field, count(*) from public._check_errors
--   where failed_field like 'ans_data:%' group by 1 order by 2 desc;
-- ============================================================================
