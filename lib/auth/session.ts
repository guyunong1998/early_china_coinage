import 'server-only'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'

/** Null whenever nobody's signed in; the logged-in user's email otherwise. */
export async function getCurrentUserEmail(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user.email ?? null
}
