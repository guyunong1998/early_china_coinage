'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'

/** Placed at the bottom of the About page rather than in the site chrome --
 * deliberately quiet, for the small handful of authorized collaborators, not
 * a general-audience "log in" call to action. Only ever shows anything in
 * production -- /api/auth/me returns { email: null } unconditionally in
 * dev, so this renders nothing there. */
export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data: { email: string | null }) => {
        if (!cancelled) {
          setEmail(data.email)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded) return null

  return (
    <div className="mt-10 flex justify-center border-t border-gray-100 pt-6">
      {email ? (
        <form action={signOut} className="flex items-center gap-2 text-xs text-gray-400">
          <span title={email}>Editing enabled</span>
          <button type="submit" className="underline hover:text-brand">
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/login" className="text-xs text-gray-400 underline hover:text-brand">
          Switch to edit mode
        </Link>
      )}
    </div>
  )
}
