import 'server-only'
import { headers } from 'next/headers'
import { auth, isAdminEmail } from '@/lib/auth/auth'

/** Editing with no login at all: only under `npm run dev`, and only when
 * .env.local opts in with ALLOW_EDITS_WITHOUT_LOGIN=true -- so a dev server
 * that ends up reachable from a network still asks for a login by default.
 * Production builds never skip it. */
export function editsWithoutLogin(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_EDITS_WITHOUT_LOGIN === 'true'
}

/**
 * True for a signed-in Better Auth user whose email is in ADMIN_EMAILS
 * (lib/auth/auth.ts), or always when editsWithoutLogin(). MySQL has no
 * row-level security, so unlike the old Supabase setup this check IS the
 * enforcement boundary -- every write path must go through
 * assertAuthorized() / beginWrite().
 */
export async function isAuthorized(): Promise<boolean> {
  if (editsWithoutLogin()) return true
  const session = await auth.api.getSession({ headers: await headers() })
  return isAdminEmail(session?.user.email)
}

/** First line of every exported Server Action in lib/admin/*-actions.ts,
 * before touching FormData or the database -- a Server Action is invoked
 * as a POST resolved server-side back to this function body, so even a raw
 * POST to a captured action reference on a production deployment still
 * hits this throw first. */
export async function assertAuthorized(): Promise<void> {
  if (!(await isAuthorized())) {
    throw new Error('You must be signed in as an authorized collaborator to edit.')
  }
}
