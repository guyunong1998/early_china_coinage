-- Aggregate sum for the home page's hero banner stats (getDatabaseStats()
-- in lib/queries.ts). Replaces sumTotalQuantityForMap(), which currently
-- pulls all ~1,797 rows of v_coin_map_sites (site_code,
-- total_quantity_for_map) down to the app just to add up one column --
-- a full-table fetch to compute a single number.
--
-- Plain aggregate selects (`.select('total_quantity_for_map.sum()')` via
-- PostgREST) are NOT an option here: this project has PostgREST's
-- db-aggregates-enabled setting off (confirmed live -- a direct REST call
-- with that select returns PGRST123 "Use of aggregate functions is not
-- allowed"), so the sum has to happen in a function instead.
--
-- `stable`, not `security definer`, since RLS already grants public SELECT
-- on v_coin_map_sites (confirmed via pg_policies) -- this function reads
-- under the caller's own role, same as query the app could already run
-- directly, just without shipping every row to do it.
--
-- Run by hand in the Supabase SQL editor -- this repo has no migration
-- runner, scripts/*.sql is the existing convention (see add-flat-views.sql).
-- No explicit grant needed: functions in the public schema are executable
-- by PUBLIC (and so by PostgREST's anon role) by default, same as
-- public.is_admin() in add-admin-write-rls.sql.
--
-- Before wiring into app code: run `select public.sum_total_quantity_for_map();`
-- and compare against the home page's current "X coins" figure to confirm
-- it matches exactly.

create or replace function public.sum_total_quantity_for_map() returns bigint
language sql stable
set search_path = public
as $$
  select coalesce(sum(total_quantity_for_map), 0) from v_coin_map_sites;
$$;
