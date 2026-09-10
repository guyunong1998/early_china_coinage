import 'server-only'
import type { z } from 'zod'
import { assertAuthorized, getWriteClient } from '@/lib/admin/guard'
import type { ActionState } from '@/lib/admin/types'

type Db = Awaited<ReturnType<typeof getWriteClient>>

/** assertAuthorized + getWriteClient, with the one real throw risk in every
 * action's prologue (not signed in, or a dev-setup error from getWriteClient)
 * caught here once and turned into a normal ActionState — instead of each
 * action file deciding on its own whether to wrap this in try/catch. */
export async function beginWrite(): Promise<{ ok: true; db: Db } | { ok: false; result: ActionState<never> }> {
  try {
    await assertAuthorized()
    const db = await getWriteClient()
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

/**
 * Inserts a row, and if it collides with a unique constraint (Postgres error
 * 23505), re-selects and returns the existing row instead of erroring — the
 * "quick create" taxonomy actions (createMint, createState,
 * createCoinTypeHierarchy) all resolve duplicates this way, since picking an
 * already-catalogued name should just resolve to that row, not fail.
 *
 * Takes plain thunks rather than a query-builder callback so callers can
 * shape each insert/lookup however their table needs (a single .eq(), or
 * several .is()/.eq() calls for a composite key) without this helper needing
 * to know Supabase's query-builder generics.
 */
export async function insertOrFindExisting<T>(
  insert: () => PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
  findExisting: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  existingMessage: string
): Promise<{ ok: true; data: T; message: string } | { ok: false; formError: string }> {
  const { data, error } = await insert()
  if (!error) return { ok: true, data: data as T, message: 'Created.' }
  if (error.code !== '23505') return { ok: false, formError: error.message }

  const { data: existing, error: selectError } = await findExisting()
  if (selectError) return { ok: false, formError: selectError.message }
  return { ok: true, data: existing as T, message: existingMessage }
}
