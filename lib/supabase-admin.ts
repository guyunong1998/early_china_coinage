import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Service-role client — bypasses RLS entirely. Every table's RLS policy
 * currently grants SELECT only to the anon/public role (no INSERT/UPDATE/
 * DELETE policy exists anywhere), so this is the only thing in the app that
 * can write to Supabase at all.
 *
 * NEVER import this directly outside lib/admin/guard.ts. Server Actions get
 * it (or, in production, a session-scoped RLS-respecting client instead) via
 * getWriteClient() in lib/admin/guard.ts, after assertAuthorized() has run.
 *
 * Built lazily, on first call, rather than as a module-level const: dev is
 * the only caller (see getWriteClient), so constructing it eagerly at
 * import time would make SUPABASE_SERVICE_ROLE_KEY a hard requirement in
 * production too, just for this module to load without throwing — even
 * though production never actually calls this function.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!supabaseUrl || !serviceRoleKey) {
      // createClient(url, undefined) throws a cryptic "supabaseKey is required"
      // — surface the real fix instead so Add citation / other admin forms
      // can show it as a formError.
      throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY in .env.local. Copy the service_role key from Supabase → Project Settings → API, then restart npm run dev.'
      )
    }
    cached = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return cached
}
