'use server'

import { randomUUID } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { deleteWithLog } from '@/lib/admin/deletion-log'
import { beginMutation, beginWrite, formErrorOf, required } from '@/lib/admin/mutation'
import { sourceSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { Db } from '@/lib/db'
import { sources } from '@/lib/db/schema'
import type { Source } from '@/lib/types'

async function selectSource(db: Db, id: string): Promise<Source> {
  return required((await db.select().from(sources).where(eq(sources.id, id)))[0]) as Source
}

function revalidateSources() {
  revalidatePath('/sources')
  revalidatePath('/sites/[site_code]', 'page')
}

export async function createSource(_prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
  const begun = await beginMutation(sourceSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  // parsed.id is undefined on create (sourceSchema's id is .optional()); the
  // new id is generated here so the row can be re-selected after insert.
  const id = randomUUID()
  let data: Source
  try {
    await db.insert(sources).values({ ...parsed, id })
    data = await selectSource(db, id)
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSources()
  return { ok: true, data, message: 'Created.' }
}

export async function updateSource(_prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
  const begun = await beginMutation(sourceSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun
  if (!parsed.id) return { ok: false, formError: 'Missing source id.' }

  const { id, ...rest } = parsed
  let data: Source
  try {
    await db.update(sources).set(rest).where(eq(sources.id, id))
    data = await selectSource(db, id)
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSources()
  return { ok: true, data, message: 'Saved.' }
}

/** `source_links.source_code` is ON DELETE RESTRICT, so this correctly fails
 * (surfaced as a form error, not a crash) if the source still has links —
 * remove those first. */
export async function deleteSource(id: string): Promise<ActionState<null>> {
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  try {
    await deleteWithLog(begun.db, [{ table: 'sources', query: sql`select * from sources where id = ${id}` }], (tx) =>
      tx.delete(sources).where(eq(sources.id, id))
    )
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSources()
  return { ok: true, data: null, message: 'Deleted.' }
}
