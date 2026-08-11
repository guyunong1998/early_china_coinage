'use server'

import { revalidatePath } from 'next/cache'
import { assertAuthorized, getWriteClient } from '@/lib/admin/guard'
import { sourceSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { Source } from '@/lib/types'

function revalidateSources() {
  revalidatePath('/sources')
  revalidatePath('/sites/[site_code]', 'page')
}

export async function createSource(_prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
  try {
    await assertAuthorized()
    const db = await getWriteClient()
    const parsed = sourceSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

    // parsed.data.id is undefined on create (sourceSchema's id is .optional())
    // and JSON.stringify drops undefined-valued keys, so no need to strip it.
    const { data, error } = await db.from('sources').insert(parsed.data).select('*').single()
    if (error) return { ok: false, formError: error.message }

    revalidateSources()
    return { ok: true, data, message: 'Created.' }
  } catch (err) {
    return {
      ok: false,
      formError: err instanceof Error ? err.message : 'Failed to create source.',
    }
  }
}

export async function updateSource(_prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
  try {
    await assertAuthorized()
    const db = await getWriteClient()
    const parsed = sourceSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }
    if (!parsed.data.id) return { ok: false, formError: 'Missing source id.' }

    const { id, ...rest } = parsed.data
    const { data, error } = await db.from('sources').update(rest).eq('id', id).select('*').single()
    if (error) return { ok: false, formError: error.message }

    revalidateSources()
    return { ok: true, data, message: 'Saved.' }
  } catch (err) {
    return {
      ok: false,
      formError: err instanceof Error ? err.message : 'Failed to save source.',
    }
  }
}

/** `source_links.source_code` is ON DELETE RESTRICT, so this correctly fails
 * (surfaced as a form error, not a crash) if the source still has links —
 * remove those first. */
export async function deleteSource(id: string): Promise<ActionState<null>> {
  try {
    await assertAuthorized()
    const db = await getWriteClient()
    const { error } = await db.from('sources').delete().eq('id', id)
    if (error) return { ok: false, formError: error.message }

    revalidateSources()
    return { ok: true, data: null, message: 'Deleted.' }
  } catch (err) {
    return {
      ok: false,
      formError: err instanceof Error ? err.message : 'Failed to delete source.',
    }
  }
}
