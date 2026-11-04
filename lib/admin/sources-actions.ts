'use server'

import { revalidatePath } from 'next/cache'
import { beginMutation, beginWrite } from '@/lib/admin/mutation'
import { sourceSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { Source } from '@/lib/types'

function revalidateSources() {
  revalidatePath('/sources')
  revalidatePath('/sites/[site_code]', 'page')
}

export async function createSource(_prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
  const begun = await beginMutation(sourceSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  // parsed.id is undefined on create (sourceSchema's id is .optional()) and
  // JSON.stringify drops undefined-valued keys, so no need to strip it.
  const { data, error } = await db.from('sources').insert(parsed).select('*').single()
  if (error) return { ok: false, formError: error.message }

  revalidateSources()
  return { ok: true, data, message: 'Created.' }
}

export async function updateSource(_prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
  const begun = await beginMutation(sourceSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun
  if (!parsed.id) return { ok: false, formError: 'Missing source id.' }

  const { id, ...rest } = parsed
  const { data, error } = await db.from('sources').update(rest).eq('id', id).select('*').single()
  if (error) return { ok: false, formError: error.message }

  revalidateSources()
  return { ok: true, data, message: 'Saved.' }
}

/** `source_links.source_code` is ON DELETE RESTRICT, so this correctly fails
 * (surfaced as a form error, not a crash) if the source still has links —
 * remove those first. */
export async function deleteSource(id: string): Promise<ActionState<null>> {
  const begun = await beginWrite()
  if (!begun.ok) return begun.result
  const { error } = await begun.db.from('sources').delete().eq('id', id)
  if (error) return { ok: false, formError: error.message }

  revalidateSources()
  return { ok: true, data: null, message: 'Deleted.' }
}
