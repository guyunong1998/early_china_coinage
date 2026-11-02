'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import type { ActionState } from '@/lib/admin/types'

const initialState: ActionState<null> = { ok: true, data: null }

export function LoginForm() {
  const router = useRouter()
  // Signs in through Better Auth's /api/auth handler (not a Server Action) so
  // its sign-in rate limit applies.
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionState<null>, formData: FormData): Promise<ActionState<null>> => {
      const email = String(formData.get('email') ?? '')
      const password = String(formData.get('password') ?? '')
      if (!email || !password) return { ok: false, formError: 'Email and password are required.' }

      const { error } = await authClient.signIn.email({ email, password })
      if (error) return { ok: false, formError: error.message ?? 'Could not sign in.' }

      router.push('/')
      router.refresh()
      return { ok: true, data: null }
    },
    initialState
  )

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <div className="panel p-6">
        <h1 className="section-heading">Sign in</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to edit this database.</p>

        <form action={formAction} className="mt-6 space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {!state.ok && state.formError && <p className="text-sm text-red-600">{state.formError}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
