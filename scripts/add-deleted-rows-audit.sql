-- Audit trail for admin deletes: a BEFORE DELETE trigger on every
-- admin-deletable table copies the row being removed (every column/value
-- intact, as JSON) into deleted_rows before it's gone. A trigger fires
-- regardless of which client issues the DELETE, so this covers both
-- production admin deletes (session-scoped client, real user JWT) and
-- local dev deletes (service-role client -- no login exists there, see
-- lib/admin/guard.ts's getWriteClient()) with no app-code changes needed.
--
-- Run by hand in the Supabase SQL editor (matches this project's existing
-- scripts/*.sql convention -- there is no in-repo migration runner).

create table if not exists public.deleted_rows (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_data jsonb not null,
  deleted_by text,
  created_at timestamptz not null default now()
);

alter table public.deleted_rows enable row level security;

-- Admins can review deletion history directly (e.g. a future admin UI) --
-- writes never go through this or any other policy, see log_deleted_row()
-- below, so there's no INSERT/UPDATE/DELETE policy at all: this table is
-- append-only via the trigger and otherwise read-only for admins.
create policy "admin_read_deleted_rows" on public.deleted_rows
  for select to authenticated using (is_admin());

-- SECURITY DEFINER so it can insert into deleted_rows regardless of which
-- role performed the delete (the service-role client bypasses RLS outright;
-- a session-scoped admin client is only ever granted DELETE, not INSERT, on
-- deleted_rows). auth.jwt() ->> 'email' is the signed-in admin's email in
-- production; the service-role key's JWT carries no email claim (only
-- role: service_role), which is exactly the local-dev, no-login case, so
-- that's the fallback.
create or replace function public.log_deleted_row() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.deleted_rows (table_name, row_data, deleted_by)
  values (TG_TABLE_NAME, to_jsonb(OLD), coalesce(auth.jwt() ->> 'email', auth.jwt() ->> 'role'));
  return OLD;
end;
$$;

-- Postgres itself already refuses to call a trigger-returning function
-- outside trigger context ("trigger functions can only be called as
-- triggers"), but Supabase's linter still flags it as a callable RPC
-- endpoint by default (SECURITY DEFINER functions in `public` are
-- PostgREST-exposed unless revoked) -- revoke that exposure explicitly.
-- Trigger firing doesn't need EXECUTE granted to the deleting role: it
-- always runs as the function's owner, since it's SECURITY DEFINER.
revoke execute on function public.log_deleted_row() from public, anon, authenticated;

-- One trigger per table admin editing can delete from today (see
-- lib/admin/*-actions.ts: deleteContext, deleteFind, deleteSource,
-- deleteSourceLink). Add a table here if a delete action for it is ever
-- added -- otherwise its deletes go unrecorded.
do $$
declare
  t text;
begin
  foreach t in array array['contexts', 'finds', 'sources', 'source_links']
  loop
    execute format('drop trigger if exists log_deleted_row on public.%I', t);
    execute format(
      'create trigger log_deleted_row before delete on public.%I for each row execute function public.log_deleted_row()',
      t
    );
  end loop;
end $$;
