import 'server-only'
import { headers } from 'next/headers'
import { editsWithoutLogin } from '@/lib/admin/guard'
import { auth } from '@/lib/auth/auth'

/** Null when login is skipped (lib/admin/guard.ts's editsWithoutLogin --
 * nothing to show) and whenever nobody's signed in; the logged-in user's
 * email otherwise. */
export async function getCurrentUserEmail(): Promise<string | null> {
  if (editsWithoutLogin()) return null

  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.email ?? null
}
