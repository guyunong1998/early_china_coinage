'use server'

import { randomUUID } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { deleteWithLog } from '@/lib/admin/deletion-log'
import { beginMutation, beginWrite, formErrorOf, required } from '@/lib/admin/mutation'
import { createSourceLinkSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import { sourceLinks } from '@/lib/db/schema'
import type { SourceLink } from '@/lib/types'

function revalidateSourceLinks() {
  revalidatePath('/sources')
  revalidatePath('/sites/[site_code]', 'page')
  revalidatePath('/mints/[mint_code]', 'page')
}

/** source_link_code isn't user-supplied — existing rows follow a
 * business-data numbering scheme (e.g. SL_JJJ_000001) this admin tool has no
 * business replicating, so admin-created links get their own clearly
 * distinct, guaranteed-unique code instead. */
export async function createSourceLink(
  _prev: ActionState<SourceLink>,
  formData: FormData
): Promise<ActionState<SourceLink>> {
  const begun = await beginMutation(createSourceLinkSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const source_link_code = `SL_ADMIN_${randomUUID()}`
  const id = randomUUID()
  let data: SourceLink
  try {
    await db.insert(sourceLinks).values({ ...parsed, id, source_link_code })
    data = required((await db.select().from(sourceLinks).where(eq(sourceLinks.id, id)))[0]) as SourceLink
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSourceLinks()
  return { ok: true, data, message: 'Citation added.' }
}

export async function deleteSourceLink(id: string): Promise<ActionState<null>> {
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  try {
    await deleteWithLog(begun.db, [{ table: 'source_links', query: sql`select * from source_links where id = ${id}` }], (tx) =>
      tx.delete(sourceLinks).where(eq(sourceLinks.id, id))
    )
  } catch (err) {
    return formErrorOf(err)
  }

  revalidateSourceLinks()
  return { ok: true, data: null, message: 'Deleted.' }
}
