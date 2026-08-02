-- ============================================================================
-- Merge public.deprecated_coin_types into public.coin_issues, then drop it.
--
-- deprecated_coin_types predates the normalized schema (coin_issues +
-- coin_type_hierarchy + mints + states + inscriptions) and was left behind
-- after that normalization happened. Every one of its rows already has a
-- matching coin_issues row -- same coin_type_code, unique on both sides --
-- so this is an UPDATE joined on that code, not an insert of new rows.
--
-- Only the Chinese side of the old table's hardcoded text columns is kept
-- (major_type_en/minor_type_en/inscription_en/mint_en/state_en are dropped
-- entirely); major_type_zh + minor_type_zh are combined into one
-- comma-joined legacy_type column. description_zh/en, note_zh/en, and
-- reverse_inscription already agree between the two tables for every
-- matched row, so those aren't touched here.
--
-- Many of the matched coin_issues rows still have a null mint_id/state_id/
-- inscription_id -- for those, the new legacy_mint/legacy_state/
-- legacy_inscription columns are currently the *only* place that
-- information exists, since the app's normalized mint_zh/state_zh/
-- inscription display fields are joined live off those (null) FKs.
--
-- Each numbered section is self-contained, so this is safe to run top to
-- bottom or one statement at a time in the Supabase SQL editor. Stop and
-- review after section 3 (verification) before running section 4 (the
-- irreversible DROP TABLE).
-- ============================================================================

-- 1. Add the new legacy_* columns to coin_issues ----------------------------
alter table public.coin_issues
  add column if not exists legacy_type text,
  add column if not exists legacy_inscription text,
  add column if not exists legacy_mint text,
  add column if not exists legacy_state text;

-- 2. Backfill from deprecated_coin_types, joined on coin_type_code ---------
-- concat_ws skips nulls (and never leaves a dangling separator), so the
-- couple of rows with a null minor_type_zh just get major_type_zh alone.
update public.coin_issues ci
set
  legacy_type = concat_ws(',', dep.major_type_zh, dep.minor_type_zh),
  legacy_inscription = dep.inscription,
  legacy_mint = dep.mint_zh,
  legacy_state = dep.state_zh
from public.deprecated_coin_types dep
where ci.coin_type_code = dep.coin_type_code;

-- 3. Verification -- run these and review before section 4 -----------------

-- Expect this to equal `select count(*) from deprecated_coin_types` (1538
-- as of this writing).
select count(*) as updated_count
from public.coin_issues
where legacy_type is not null;

-- Sanity check on join cardinality: coin_type_code is unique on both sides,
-- so this should return zero rows.
select ci.id, ci.coin_type_code, count(*)
from public.coin_issues ci
join public.deprecated_coin_types dep on dep.coin_type_code = ci.coin_type_code
group by ci.id, ci.coin_type_code
having count(*) > 1;

-- Spot check a handful of rows side by side against the source table.
select
  ci.coin_type_code,
  ci.legacy_type,
  ci.legacy_inscription,
  ci.legacy_mint,
  ci.legacy_state,
  dep.major_type_zh,
  dep.minor_type_zh,
  dep.inscription,
  dep.mint_zh,
  dep.state_zh
from public.coin_issues ci
join public.deprecated_coin_types dep on dep.coin_type_code = ci.coin_type_code
order by ci.coin_type_code
limit 10;

-- 4. Drop the old views and table -- IRREVERSIBLE, only run after reviewing
-- section 3. old_v_coin_map_sites reads from old_v_coin_finds, and
-- old_v_coin_finds reads from deprecated_coin_types, so they must go in this
-- order. Both views are fully superseded by v_coin_map_sites/v_coin_finds,
-- which join through coin_issues (+ coin_type_hierarchy/mints/states/
-- inscriptions) instead.
-- ============================================================================
drop view public.old_v_coin_map_sites;
drop view public.old_v_coin_finds;
drop table public.deprecated_coin_types;
