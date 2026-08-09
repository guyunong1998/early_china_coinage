import { NextResponse } from 'next/server'
import { getCurrentUserEmail } from '@/lib/auth/session'

/**
 * Fetched client-side by SiteHeader only, so the login-state check doesn't
 * force every page in the app to render dynamically -- only this one small
 * request depends on cookies/session, not the whole page shell.
 */
export async function GET() {
  const email = await getCurrentUserEmail()
  return NextResponse.json({ email })
}
