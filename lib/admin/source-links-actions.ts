'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { assertAuthorized, getWriteClient } from '@/lib/admin/guard'
import { createSourceLinkSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { SourceLink } from '@/lib/types'

function revalidateSourceLinks() {
  revalidatePath('/sources')
  revalidatePath('/sites/[site_code]', 'page')
  revalidatePath('/mints/[mint_code]', 'page')
}

function actionError(err: unknown, fallback: string): ActionState<never> {
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, formError: message }
}

/** source_link_code isn't user-supplied — existing rows follow a
 * business-data numbering scheme (e.g. SL_JJJ_000001) this admin tool has no
 * business replicating, so admin-created links get their own clearly
 * distinct, guaranteed-unique code instead. */
export async function createSourceLink(
  _prev: ActionState<SourceLink>,
  formData: FormData
): Promise<ActionState<SourceLink>> {
  try {
    await assertAuthorized()
    const db = await getWriteClient()
    const parsed = createSourceLinkSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

    const source_link_code = `SL_ADMIN_${randomUUID()}`
    const { data, error } = await db
      .from('source_links')
      .insert({ ...parsed.data, source_link_code })
      .select('*')
      .single()
    if (error) return { ok: false, formError: error.message }

    revalidateSourceLinks()
    return { ok: true, data, message: 'Citation added.' }
  } catch (err) {
    return actionError(err, 'Failed to add citation.')
  }
}

export async function deleteSourceLink(id: string): Promise<ActionState<null>> {
  try {
    await assertAuthorized()
    const db = await getWriteClient()
    const { error } = await db.from('source_links').delete().eq('id', id)
    if (error) return { ok: false, formError: error.message }

    revalidateSourceLinks()
    return { ok: true, data: null, message: 'Deleted.' }
  } catch (err) {
    return actionError(err, 'Failed to delete citation.')
  }
}
