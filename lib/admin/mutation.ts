import 'server-only'
import type { z } from 'zod'
import { assertAuthorized } from '@/lib/admin/guard'
import type { ActionState } from '@/lib/admin/types'
import { db, type Db } from '@/lib/db'

/** assertAuthorized + the database handle, with the one real throw risk in
 * every action's prologue (not signed in) caught here once and turned into a
 * normal ActionState — instead of each action file deciding on its own
 * whether to wrap this in try/catch. */
export async function beginWrite(): Promise<{ ok: true; db: Db } | { ok: false; result: ActionState<never> }> {
  try {
    await assertAuthorized()
    return { ok: true, db }
  } catch (err) {
    return { ok: false, result: { ok: false, formError: err instanceof Error ? err.message : 'Not authorized.' } }
  }
}

/** beginWrite, plus the FormData -> schema.safeParse step every mutating
 * action starts with. Callers do:
 *   const begun = await beginMutation(fooSchema, formData)
 *   if (!begun.ok) return begun.result
 *   const { db, data } = begun
 */
export async function beginMutation<S extends z.ZodType>(
  schema: S,
  formData: FormData
): Promise<{ ok: true; db: Db; data: z.infer<S> } | { ok: false; result: ActionState<never> }> {
  const begun = await beginWrite()
  if (!begun.ok) return begun

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, result: { ok: false, fieldErrors: parsed.error.flatten().fieldErrors } }

  return { ok: true, db: begun.db, data: parsed.data }
}

/** The mysql2 error under Drizzle's "Failed query: ..." wrapper, if any. */
function driverError(err: unknown): { code?: string; message?: string } | undefined {
  if (!(err instanceof Error)) return undefined
  return (err.cause ?? err) as { code?: string; message?: string }
}

/** MySQL's duplicate-key error (Postgres's 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return driverError(err)?.code === 'ER_DUP_ENTRY'
}

/** The database's own message (e.g. a foreign-key or duplicate-key error)
 * for a form error, rather than Drizzle's wrapper, which embeds the SQL. */
export function formErrorOf(err: unknown, fallback = 'Database error.'): { ok: false; formError: string } {
  return { ok: false, formError: driverError(err)?.message ?? fallback }
}

/** Throws if an update/insert's follow-up select found nothing — the old
 * supabase-js `.single()` contract. */
export function required<T>(row: T | null | undefined): T {
  if (row == null) throw new Error('Row not found.')
  return row
}

/**
 * Inserts a row, and if it collides with a unique constraint, looks up and
 * returns the existing row instead of erroring — the "quick create" taxonomy
 * actions (createMint, createState, createCoinTypeHierarchy) all resolve
 * duplicates this way, since picking an already-catalogued name should just
 * resolve to that row, not fail.
 */
export async function insertOrFindExisting<T>(
  insert: () => Promise<T>,
  findExisting: () => Promise<T | null | undefined>,
  existingMessage: string
): Promise<{ ok: true; data: T; message: string } | { ok: false; formError?: string }> {
  try {
    return { ok: true, data: await insert(), message: 'Created.' }
  } catch (err) {
    if (!isUniqueViolation(err)) return formErrorOf(err)
    try {
      return { ok: true, data: required(await findExisting()), message: existingMessage }
    } catch (selectErr) {
      return formErrorOf(selectErr)
    }
  }
}
