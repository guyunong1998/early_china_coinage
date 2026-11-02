'use server'

import { randomUUID } from 'crypto'
import { eq, getTableColumns, sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { deleteWithLog } from '@/lib/admin/deletion-log'
import { beginMutation, beginWrite, formErrorOf, isUniqueViolation, required } from '@/lib/admin/mutation'
import { contextSchema, findSchema, siteSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { Db } from '@/lib/db'
import { contexts, finds, periods, sites } from '@/lib/db/schema'
import { PERIOD_EMBED, flattenPeriod, getFindById } from '@/lib/queries'
import type { Context, Find, Site } from '@/lib/types'

/** Site/context period stays free-text in the edit form (unchanged from
 * before periods was normalized into its own lookup table) — find a row
 * matching period_zh or create one, same insert-then-catch-unique-violation
 * pattern as taxonomy-actions.ts's createState. Editing period_en on an
 * existing period_zh only relabels that shared lookup row, same tradeoff
 * state_id/inscription_id already have. */
async function resolvePeriodId(db: Db, periodZh: string | null, periodEn: string | null): Promise<string | null> {
  if (!periodZh && !periodEn) return null

  const id = randomUUID()
  try {
    await db.insert(periods).values({ id, period_zh: periodZh, period_en: periodEn })
    return id
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
  }

  const [existing] = await db
    .select({ id: periods.id })
    .from(periods)
    .where(eq(periods.period_zh, periodZh as string))
    .limit(1)
  return required(existing).id
}

/** A sites/contexts row with its period flattened in — what the old
 * `.select('*, periods(period_zh, period_en)')` returned. */
async function selectWithPeriod<T>(db: Db, table: typeof sites | typeof contexts, where: SQL): Promise<T> {
  const [row] = await db
    .select({ ...getTableColumns(table), periods: PERIOD_EMBED })
    .from(table)
    .leftJoin(periods, eq(table.period_id, periods.id))
    .where(where)
    .limit(1)
  return flattenPeriod(required(row)) as T
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
  let data: Site
  try {
    const period_id = await resolvePeriodId(db, period_zh, period_en)
    await db.update(sites).set({ ...rest, period_id }).where(eq(sites.site_code, site_code))
    data = await selectWithPeriod<Site>(db, sites, eq(sites.site_code, site_code))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSite(site_code)
  return { ok: true, data, message: 'Saved.' }
}

// ── contexts ─────────────────────────────────────────────────────────────

export async function createContext(_prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
  const begun = await beginMutation(contextSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  // parsed.id is undefined on create (contextSchema's id is .optional());
  // the new id is generated here so the row can be re-selected after insert.
  const { period_zh, period_en, ...rest } = parsed
  const id = randomUUID()
  let data: Context
  try {
    const period_id = await resolvePeriodId(db, period_zh, period_en)
    await db.insert(contexts).values({ ...rest, id, period_id })
    data = await selectWithPeriod<Context>(db, contexts, eq(contexts.id, id))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSite(parsed.site_code)
  return { ok: true, data, message: 'Added.' }
}

export async function updateContext(_prev: ActionState<Context>, formData: FormData): Promise<ActionState<Context>> {
  const begun = await beginMutation(contextSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun
  if (!parsed.id) return { ok: false, formError: 'Missing context id.' }

  const { id, period_zh, period_en, ...rest } = parsed
  let data: Context
  try {
    const period_id = await resolvePeriodId(db, period_zh, period_en)
    await db.update(contexts).set({ ...rest, period_id }).where(eq(contexts.id, id))
    data = await selectWithPeriod<Context>(db, contexts, eq(contexts.id, id))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSite(parsed.site_code)
  return { ok: true, data, message: 'Saved.' }
}

export async function deleteContext(id: string, siteCode: string): Promise<ActionState<null>> {
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  try {
    // finds and their coin_items go with the context (ON DELETE CASCADE).
    await deleteWithLog(
      begun.db,
      [
        { table: 'contexts', query: sql`select * from contexts where id = ${id}` },
        {
          table: 'finds',
          query: sql`select f.* from finds f join contexts c on c.context_code = f.context_code where c.id = ${id}`,
        },
        {
          table: 'coin_items',
          query: sql`select ci.* from coin_items ci join finds f on f.find_code = ci.find_code join contexts c on c.context_code = f.context_code where c.id = ${id}`,
        },
      ],
      (tx) => tx.delete(contexts).where(eq(contexts.id, id))
    )
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSite(siteCode)
  return { ok: true, data: null, message: 'Deleted.' }
}

// ── finds ────────────────────────────────────────────────────────────────

export async function createFind(_prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
  const begun = await beginMutation(findSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const id = randomUUID()
  let data: Find
  try {
    await db.insert(finds).values({ ...parsed, id })
    data = required(await getFindById(id))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data, message: 'Added.' }
}

export async function updateFind(_prev: ActionState<Find>, formData: FormData): Promise<ActionState<Find>> {
  const begun = await beginMutation(findSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun
  if (!parsed.id) return { ok: false, formError: 'Missing find id.' }

  const { id, ...rest } = parsed
  let data: Find
  try {
    await db.update(finds).set(rest).where(eq(finds.id, id))
    data = required(await getFindById(id))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data, message: 'Saved.' }
}

export async function deleteFind(id: string): Promise<ActionState<null>> {
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  try {
    // coin_items go with the find (ON DELETE CASCADE).
    await deleteWithLog(
      begun.db,
      [
        { table: 'finds', query: sql`select * from finds where id = ${id}` },
        { table: 'coin_items', query: sql`select ci.* from coin_items ci join finds f on f.find_code = ci.find_code where f.id = ${id}` },
      ],
      (tx) => tx.delete(finds).where(eq(finds.id, id))
    )
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/sites/[site_code]', 'page')
  return { ok: true, data: null, message: 'Deleted.' }
}
