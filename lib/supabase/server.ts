import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Cookie-aware, session-scoped client -- reads whichever user is logged in
 * for the current request and respects RLS (unlike lib/supabase-admin.ts,
 * which bypasses it entirely). Setting cookies only succeeds from a Server
 * Action or Route Handler; calls from a plain Server Component render no-op
 * silently (session refresh happens in proxy.ts instead).
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component -- ignore, proxy.ts handles refresh.
        }
      },
    },
  })
}
