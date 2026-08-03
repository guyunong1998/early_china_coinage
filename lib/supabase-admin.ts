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
 * NEVER import this outside lib/admin/*-actions.ts. The `server-only` import
 * above makes an accidental client-component import a build-time error, but
 * it doesn't stop another server file from importing it — every call site
 * must still independently call assertDevOnly() (see lib/admin/guard.ts)
 * before touching this client.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
