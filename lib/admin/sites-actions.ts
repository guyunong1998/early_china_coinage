'use server'

import { revalidatePath } from 'next/cache'
import { assertDevOnly } from '@/lib/admin/guard'
import { contextSchema, findSchema, siteSchema } from '@/lib/admin/schemas'
import { COIN_ISSUE_FIELDS, flattenCoinIssue, type CoinIssueEmbed } from '@/lib/queries'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ActionState } from '@/lib/admin/types'
import type { Context, Find, Site } from '@/lib/types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Re-shapes a `finds` row with an embedded `coin_issues(...)` into the
 * `Find` type getSiteFinds produces, so a saved find's display doesn't lose
 * its type/inscription/mint/state labels until the next full page load. */
function flattenFind(row: Omit<Find, 'coin_issues'> & { coin_issues: CoinIssueEmbed | CoinIssueEmbed[] | null }): Find {
  const coinIssue = one(row.coin_issues)
  return { ...row, coin_issues: coinIssue ? flattenCoinIssue(coinIssue) : null }
}

function revalidateSite(siteCode: string) {
  revalidatePath(`/sites/${siteCode}`)
}

// ── sites ────────────────────────────────────────────────────────────────

export async function updateSite(_prev: ActionState<Site>, formData: FormData): Promise<ActionState<Site>> {
  assertDevOnly()
  const parsed = siteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const { site_code, ...rest } = parsed.data
  const { data, error } = await supabaseAdmin
    .from('sites')
    .update(rest)
    .eq('site_code', site_code)
    .select('*')
    .single()

  if (error) return { ok: false, formError: error.message }

  revalidateSite(site_code)
  return { ok: true, data, message: 'Saved.' }
}

// ── contexts ─────────────────────────────────────────────────────────────

export async function createContext(_prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
  assertDevOnly()
  const parsed = contextSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  // parsed.data.id is undefined on create (contextSchema's id is .optional())
  // and JSON.stringify drops undefined-valued keys, so no need to strip it.
  const { data, error } = await supabaseAdmin.from('contexts').insert(parsed.data).select('*').single()
  if (error) return { ok: false, formError: error.message }

  revalidateSite(parsed.data.site_code)
  return { ok: true, data, message: 'Added.' }
}

export async function updateContext(_prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
  assertDevOnly()
  const parsed = contextSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }
  if (!parsed.data.id) return { ok: false, formError: 'Missing context id.' }

  const { id, ...rest } = parsed.data
  const { data, error } = await supabaseAdmin.from('contexts').update(rest).eq('id', id).select('*').single()
  if (error) return { ok: false, formError: error.message }

  revalidateSite(parsed.data.site_code)
  return { ok: true, data, message: 'Saved.' }
}

export async function deleteContext(id: string, siteCode: string): Promise<ActionState<null>> {
  assertDevOnly()
  const { error } = await supabaseAdmin.from('contexts').delete().eq('id', id)
  if (error) return { ok: false, formError: error.message }

  revalidateSite(siteCode)
  return { ok: true, data: null, message: 'Deleted.' }
}

// ── finds ────────────────────────────────────────────────────────────────

export async function createFind(_prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
  assertDevOnly()
  const parsed = findSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const { data, error } = await supabaseAdmin
    .from('finds')
    .insert(parsed.data)
    .select(`*, coin_issues(${COIN_ISSUE_FIELDS})`)
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data: flattenFind(data), message: 'Added.' }
}

export async function updateFind(_prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
  assertDevOnly()
  const parsed = findSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }
  if (!parsed.data.id) return { ok: false, formError: 'Missing find id.' }

  const { id, ...rest } = parsed.data
  const { data, error } = await supabaseAdmin
    .from('finds')
    .update(rest)
    .eq('id', id)
    .select(`*, coin_issues(${COIN_ISSUE_FIELDS})`)
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data: flattenFind(data), message: 'Saved.' }
}

export async function deleteFind(id: string): Promise<ActionState<null>> {
  assertDevOnly()
  const { error } = await supabaseAdmin.from('finds').delete().eq('id', id)
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data: null, message: 'Deleted.' }
}
