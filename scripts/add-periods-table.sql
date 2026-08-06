-- ============================================================================
-- Move period_zh/period_en out of public.sites and public.contexts into a
-- shared public.periods lookup table, following the same normalization
-- pattern already used for mints/states/inscriptions off coin_issues.
--
-- sites and contexts each keep their own period_id -- a context can have a
-- different period than the site it sits in (e.g. a later-period context
-- excavated within an otherwise earlier-period site) -- they just share one
-- lookup table so "Warring States" isn't spelled out (and drifts) in two
-- places.
--
-- period_zh is treated as the canonical key (period_en is its translation),
-- matching how app/search/page.tsx already builds a zh->en map off live
-- site data. Section 2's verification query flags any period_zh that maps
-- to more than one distinct period_en across existing rows -- review that
-- before trusting the backfill in section 3/4.
--
-- Run by hand in the Supabase SQL editor (matches this project's existing
-- scripts/*.sql convention -- there is no in-repo migration runner). Stop
-- and review after each verification step; section 6 (dropping the old
-- columns) is irreversible.
-- ============================================================================

-- 1. Create the lookup table -------------------------------------------------
create table public.periods (
  id uuid not null default gen_random_uuid (),
  period_zh text null,
  period_en text null,
  created_at timestamp with time zone not null default now(),
  constraint periods_pkey primary key (id)
);

create unique index periods_period_zh_key on public.periods (period_zh)
where period_zh is not null;

-- 2. Verification -- run before section 3 -----------------------------------

-- Any period_zh here maps to more than one period_en across sites/contexts.
-- Section 3 picks one (alphabetically first) per period_zh -- if this
-- returns rows, decide by hand which spelling is correct and fix the source
-- data first, otherwise the backfill will silently normalize onto one.
select period_zh, array_agg(distinct period_en) as period_en_variants
from (
  select period_zh, period_en from public.sites where period_zh is not null
  union all
  select period_zh, period_en from public.contexts where period_zh is not null
) t
group by period_zh
having count(distinct period_en) > 1;

-- 3. Backfill periods from distinct values in sites + contexts --------------
insert into public.periods (period_zh, period_en)
select distinct on (period_zh) period_zh, period_en
from (
  select period_zh, period_en from public.sites where period_zh is not null
  union all
  select period_zh, period_en from public.contexts where period_zh is not null
) t
order by period_zh, period_en nulls last;

-- Rows with a period_en but no period_zh (rare data gaps) -- kept so
-- section 6 doesn't silently drop them.
insert into public.periods (period_zh, period_en)
select distinct null, period_en
from (
  select period_zh, period_en from public.sites where period_zh is null and period_en is not null
  union all
  select period_zh, period_en from public.contexts where period_zh is null and period_en is not null
) t;

-- 4. Add period_id to sites and contexts, backfill via join -----------------
alter table public.sites add column period_id uuid null;
alter table public.contexts add column period_id uuid null;

update public.sites s
set period_id = p.id
from public.periods p
where s.period_zh is not null and p.period_zh = s.period_zh;

update public.sites s
set period_id = p.id
from public.periods p
where s.period_id is null
  and s.period_zh is null and s.period_en is not null
  and p.period_zh is null and p.period_en = s.period_en;

update public.contexts c
set period_id = p.id
from public.periods p
where c.period_zh is not null and p.period_zh = c.period_zh;

update public.contexts c
set period_id = p.id
from public.periods p
where c.period_id is null
  and c.period_zh is null and c.period_en is not null
  and p.period_zh is null and p.period_en = c.period_en;

alter table public.sites
  add constraint sites_period_id_fkey foreign key (period_id) references public.periods (id) on delete set null;
alter table public.contexts
  add constraint contexts_period_id_fkey foreign key (period_id) references public.periods (id) on delete set null;

create index idx_sites_period_id on public.sites using btree (period_id);
create index idx_contexts_period_id on public.contexts using btree (period_id);

-- 5. Verification -- run before section 6 ------------------------------------

-- Both should return zero rows: every row that had a period_zh/period_en
-- before should now have a period_id.
select count(*) from public.sites where (period_zh is not null or period_en is not null) and period_id is null;
select count(*) from public.contexts where (period_zh is not null or period_en is not null) and period_id is null;

-- Spot check a handful of rows side by side against the source columns.
select s.site_code, s.period_zh, s.period_en, p.period_zh as looked_up_zh, p.period_en as looked_up_en
from public.sites s
left join public.periods p on p.id = s.period_id
where s.period_zh is not null
limit 10;

-- 6. Drop the old columns -- IRREVERSIBLE, only run after reviewing section 5
alter table public.sites drop column period_zh, drop column period_en;
alter table public.contexts drop column period_zh, drop column period_en;

-- 7. RLS -- mirror whatever policies the other lookup tables (mints, states,
-- inscriptions) already have configured (public/anon select, admin-gated
-- writes). This repo's admin-write policies are created via a loop in
-- scripts/add-admin-write-rls.sql -- add 'periods' to that array's table
-- list too so is_admin() gating stays consistent, e.g.:
alter table public.periods enable row level security;

create policy "periods_select_anon" on public.periods for select to anon, authenticated using (true);
create policy "admin_write_insert" on public.periods for insert to authenticated with check (is_admin());
create policy "admin_write_update" on public.periods for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin_write_delete" on public.periods for delete to authenticated using (is_admin());
