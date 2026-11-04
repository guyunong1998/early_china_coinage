import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * In dev (NODE_ENV !== 'production'), always true -- no login exists to
 * check against, matching today's `npm run dev` behavior.
 *
 * In production, true only for a signed-in user whose email is in the
 * admin_users table, checked via the is_admin() Postgres function -- the
 * same function every table's INSERT/UPDATE/DELETE RLS policy uses (see
 * scripts/add-admin-write-rls.sql). This app-level check is a fast-fail /
 * UI-gating convenience; the database is the actual enforcement boundary.
 */
async function isAllowedProdSession(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.email) return false

  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

export async function isAuthorized(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true
  return isAllowedProdSession()
}

/** First line of every exported Server Action in lib/admin/*-actions.ts,
 * before touching FormData or a write client -- a Server Action is invoked
 * as a POST resolved server-side back to this function body, so even a raw
 * POST to a captured action reference on a production deployment still
 * hits this throw first. */
export async function assertAuthorized(): Promise<void> {
  if (!(await isAuthorized())) {
    throw new Error('You must be signed in as an authorized collaborator to edit.')
  }
}

/**
 * Client to use for admin writes.
 *
 * - Production: caller's session-scoped client; RLS + is_admin() enforce.
 * - Dev with SUPABASE_SERVICE_ROLE_KEY: service-role client (no login).
 * - Dev without that key: fall back to a signed-in admin session if present;
 *   otherwise throw a clear setup error (instead of createClient's cryptic
 *   "supabaseKey is required", which crashed Add citation with a 500).
 */
export async function getWriteClient() {
  if (process.env.NODE_ENV === 'production') {
    return createServerSupabaseClient()
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceRoleKey) return getSupabaseAdmin()

  const sessionClient = await createServerSupabaseClient()
  const { data: claims } = await sessionClient.auth.getClaims()
  if (claims?.claims?.email) {
    const { data, error } = await sessionClient.rpc('is_admin')
    if (!error && data === true) return sessionClient
  }

  throw new Error(
    'Local editing needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API → service_role), or sign in as an admin. Restart npm run dev after adding the key.'
  )
}
