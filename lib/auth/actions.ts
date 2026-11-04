'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ActionState } from '@/lib/admin/types'

export async function signInWithPassword(_prev: ActionState<null>, formData: FormData): Promise<ActionState<null>> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { ok: false, formError: 'Email and password are required.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, formError: error.message }

  redirect('/')
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/')
}
