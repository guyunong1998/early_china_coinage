import 'server-only'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { pool } from '@/lib/db'

/**
 * Better Auth on the same MySQL pool as the rest of the app; its tables
 * (user, session, account, verification) are created by
 * scripts/better-auth-schema.sql.
 *
 * Public sign-up is disabled: with no email verification, anyone could
 * otherwise register an admin's address before they did. Accounts are
 * created out-of-band with scripts/create-user.mjs (needs DB credentials).
 * Sign-in goes through the /api/auth/* handler, not a direct auth.api call,
 * because Better Auth only applies its sign-in rate limit there.
 *
 * Needs BETTER_AUTH_SECRET (openssl rand -base64 32) and BETTER_AUTH_URL
 * (the site's public origin) in production.
 */
export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [nextCookies()],
})

/** ADMIN_EMAILS is a comma-separated allowlist — the replacement for the
 * Supabase admin_users table / is_admin() function. Being signed in is not
 * enough to edit; the account's email must be listed here. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}
