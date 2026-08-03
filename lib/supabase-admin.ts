import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Service-role client — bypasses RLS entirely. Every table's RLS policy
 * currently grants SELECT only to the anon/public role (no INSERT/UPDATE/
 * DELETE policy exists anywhere), so this is the only thing in the app that
 * can write to Supabase at all.
 *
 * NEVER import this directly outside lib/admin/guard.ts. Server Actions get
 * it (or, in production, a session-scoped RLS-respecting client instead) via
 * getWriteClient() in lib/admin/guard.ts, after assertAuthorized() has run.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
