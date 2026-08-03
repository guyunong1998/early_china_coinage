-- Adds real database-level write authorization, replacing the previous
-- setup where the service-role client (supabaseAdmin) was the only thing
-- that could write, gated solely by an app-level NODE_ENV check.
--
-- admin_users holds the allow-list of collaborator emails allowed to edit
-- in production. It has no RLS grants of its own -- it's only ever read
-- through is_admin(), a SECURITY DEFINER function, never queried directly
-- by the app or exposed to anon/authenticated roles.
--
-- Run by hand in the Supabase SQL editor (matches this project's existing
-- scripts/*.sql convention -- there is no in-repo migration runner).

create table if not exists public.admin_users (
  email text primary key
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from admin_users where email = (auth.jwt() ->> 'email')
  );
$$;

-- One INSERT/UPDATE/DELETE policy per editable table, granted to
-- `authenticated` and gated by is_admin(). Existing SELECT-for-anon
-- policies are untouched -- public reads are unaffected.
do $$
declare
  t text;
begin
  foreach t in array array[
    'sites', 'contexts', 'finds', 'coin_issues', 'mints',
    'sources', 'source_links', 'coin_type_hierarchy', 'inscriptions', 'states'
  ]
  loop
    execute format(
      'create policy "admin_write_insert" on public.%I for insert to authenticated with check (is_admin())',
      t
    );
    execute format(
      'create policy "admin_write_update" on public.%I for update to authenticated using (is_admin()) with check (is_admin())',
      t
    );
    execute format(
      'create policy "admin_write_delete" on public.%I for delete to authenticated using (is_admin())',
      t
    );
  end loop;
end $$;

-- After running this, add each trusted collaborator's email by hand, e.g.:
-- insert into public.admin_users (email) values ('collaborator@example.com');
