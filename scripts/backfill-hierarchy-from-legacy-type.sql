-- ============================================================================
-- Backfill coin_issues.coin_type_hierarchy_id from legacy_type.
--
-- A handful of coin_issues rows (the Shandong CT_SD_0500–0509 group as of
-- this writing) were created with only legacy_type / state_id / inscription
-- filled in — coin_type_hierarchy_id stayed null. Finds that point at those
-- issues therefore have a live coin_issues_id but empty deprecated_coin_type_code,
-- and v_coin_map_sites / v_coin_issues_flat (which join through the hierarchy
-- FK) show no type for those sites (南常城址 / SD_0309 is the visible example).
--
-- This UPDATE is optional: the app now resolves the same mapping at read time.
-- Running it still helps any other consumer of the views. Safe to re-run
-- (only touches rows whose hierarchy FK is still null).
-- ============================================================================

update public.coin_issues ci
set coin_type_hierarchy_id = matched.hierarchy_id
from (
  select distinct on (ci2.id)
    ci2.id as issue_id,
    cth.id as hierarchy_id
  from public.coin_issues ci2
  join public.coin_type_hierarchy cth
    on (
      (cth.level5_zh is not null and cth.level5_zh = ci2.legacy_type)
      or (
        cth.level5_zh is null
        and cth.level4_zh is not null
        and cth.level4_zh = ci2.legacy_type
      )
      or (
        cth.level4_zh is null
        and cth.level5_zh is null
        and cth.level3_zh is not null
        and cth.level3_zh = ci2.legacy_type
      )
      or (
        cth.level3_zh is null
        and cth.level4_zh is null
        and cth.level5_zh is null
        and cth.level2_zh is not null
        and cth.level2_zh = ci2.legacy_type
      )
      or (
        cth.level2_zh is null
        and cth.level3_zh is null
        and cth.level4_zh is null
        and cth.level5_zh is null
        and cth.level1_zh = ci2.legacy_type
      )
    )
  where ci2.coin_type_hierarchy_id is null
    and ci2.legacy_type is not null
    and position(',' in ci2.legacy_type) = 0
  order by
    ci2.id,
    (
      case
        when cth.level5_zh is not null then 5
        when cth.level4_zh is not null then 4
        when cth.level3_zh is not null then 3
        when cth.level2_zh is not null then 2
        else 1
      end
    )
) matched
where ci.id = matched.issue_id
  and ci.coin_type_hierarchy_id is null;

-- Expect 0 remaining after a successful run (or only rows whose legacy_type
-- does not match any hierarchy label).
select id, coin_type_code, legacy_type
from public.coin_issues
where coin_type_hierarchy_id is null
  and legacy_type is not null;
