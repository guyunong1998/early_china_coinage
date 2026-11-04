import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Null in dev (nothing to show — there's no login there) and whenever
 * nobody's signed in; the logged-in user's email otherwise. */
export async function getCurrentUserEmail(): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production') return null

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.email ?? null
}
