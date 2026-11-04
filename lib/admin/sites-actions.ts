'use server'

import { revalidatePath } from 'next/cache'
import type { getWriteClient } from '@/lib/admin/guard'
import { beginMutation, beginWrite } from '@/lib/admin/mutation'
import { contextSchema, findSchema, siteSchema } from '@/lib/admin/schemas'
import { COIN_ISSUE_FIELDS, flattenCoinIssue, flattenPeriod, type CoinIssueEmbed } from '@/lib/queries'
import type { ActionState } from '@/lib/admin/types'
import type { Context, Find, Site } from '@/lib/types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Site/context period stays free-text in the edit form (unchanged from
 * before periods was normalized into its own lookup table) — find a row
 * matching period_zh or create one, same insert-then-catch-unique-violation
 * pattern as taxonomy-actions.ts's createState. Editing period_en on an
 * existing period_zh only relabels that shared lookup row, same tradeoff
 * state_id/inscription_id already have. */
async function resolvePeriodId(
  db: Awaited<ReturnType<typeof getWriteClient>>,
  periodZh: string | null,
  periodEn: string | null
): Promise<string | null> {
  if (!periodZh && !periodEn) return null

  const { data, error } = await db
    .from('periods')
    .insert({ period_zh: periodZh, period_en: periodEn })
    .select('id')
    .single()
  if (!error) return data.id
  if (error.code !== '23505') throw error

  const { data: existing, error: selectError } = await db
    .from('periods')
    .select('id')
    .eq('period_zh', periodZh as string)
    .single()
  if (selectError) throw selectError
  return existing.id
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
  const begun = await beginMutation(siteSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const { site_code, period_zh, period_en, ...rest } = parsed
  let period_id: string | null
  try {
    period_id = await resolvePeriodId(db, period_zh, period_en)
  } catch (err) {
    return { ok: false, formError: err instanceof Error ? err.message : 'Failed to resolve period.' }
  }

  const { data, error } = await db
    .from('sites')
    .update({ ...rest, period_id })
    .eq('site_code', site_code)
    .select('*, periods(period_zh, period_en)')
    .single()

  if (error) return { ok: false, formError: error.message }

  revalidateSite(site_code)
  return { ok: true, data: flattenPeriod(data), message: 'Saved.' }
}

// ── contexts ─────────────────────────────────────────────────────────────

export async function createContext(_prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
  const begun = await beginMutation(contextSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  // parsed.id is undefined on create (contextSchema's id is .optional()) and
  // JSON.stringify drops undefined-valued keys, so no need to strip it.
  const { period_zh, period_en, ...rest } = parsed
  let period_id: string | null
  try {
    period_id = await resolvePeriodId(db, period_zh, period_en)
  } catch (err) {
    return { ok: false, formError: err instanceof Error ? err.message : 'Failed to resolve period.' }
  }

  const { data, error } = await db
    .from('contexts')
    .insert({ ...rest, period_id })
    .select('*, periods(period_zh, period_en)')
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidateSite(parsed.site_code)
  return { ok: true, data: flattenPeriod(data), message: 'Added.' }
}

export async function updateContext(_prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
  const begun = await beginMutation(contextSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun
  if (!parsed.id) return { ok: false, formError: 'Missing context id.' }

  const { id, period_zh, period_en, ...rest } = parsed
  let period_id: string | null
  try {
    period_id = await resolvePeriodId(db, period_zh, period_en)
  } catch (err) {
    return { ok: false, formError: err instanceof Error ? err.message : 'Failed to resolve period.' }
  }

  const { data, error } = await db
    .from('contexts')
    .update({ ...rest, period_id })
    .eq('id', id)
    .select('*, periods(period_zh, period_en)')
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidateSite(parsed.site_code)
  return { ok: true, data: flattenPeriod(data), message: 'Saved.' }
}

export async function deleteContext(id: string, siteCode: string): Promise<ActionState<null>> {
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  const { error } = await begun.db.from('contexts').delete().eq('id', id)
  if (error) return { ok: false, formError: error.message }

  revalidateSite(siteCode)
  return { ok: true, data: null, message: 'Deleted.' }
}

// ── finds ────────────────────────────────────────────────────────────────

export async function createFind(_prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
  const begun = await beginMutation(findSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const { data, error } = await db
    .from('finds')
    .insert(parsed)
    .select(`*, coin_issues(${COIN_ISSUE_FIELDS})`)
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data: flattenFind(data), message: 'Added.' }
}

export async function updateFind(_prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
  const begun = await beginMutation(findSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun
  if (!parsed.id) return { ok: false, formError: 'Missing find id.' }

  const { id, ...rest } = parsed
  const { data, error } = await db
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
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  const { error } = await begun.db.from('finds').delete().eq('id', id)
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data: null, message: 'Deleted.' }
}
