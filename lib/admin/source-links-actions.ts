'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { assertDevOnly } from '@/lib/admin/guard'
import { createSourceLinkSchema } from '@/lib/admin/schemas'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ActionState } from '@/lib/admin/types'
import type { SourceLink } from '@/lib/types'

function revalidateSourceLinks() {
  revalidatePath('/sources')
  revalidatePath('/sites/[site_code]', 'page')
}

/** source_link_code isn't user-supplied — existing rows follow a
 * business-data numbering scheme (e.g. SL_JJJ_000001) this admin tool has no
 * business replicating, so admin-created links get their own clearly
 * distinct, guaranteed-unique code instead. */
export async function createSourceLink(
  _prev: ActionState<SourceLink>,
  formData: FormData
): Promise<ActionState<SourceLink>> {
  assertDevOnly()
  const parsed = createSourceLinkSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const source_link_code = `SL_ADMIN_${randomUUID()}`
  const { data, error } = await supabaseAdmin
    .from('source_links')
    .insert({ ...parsed.data, source_link_code })
    .select('*')
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidateSourceLinks()
  return { ok: true, data, message: 'Citation added.' }
}

export async function deleteSourceLink(id: string): Promise<ActionState<null>> {
  assertDevOnly()
  const { error } = await supabaseAdmin.from('source_links').delete().eq('id', id)
  if (error) return { ok: false, formError: error.message }

  revalidateSourceLinks()
  return { ok: true, data: null, message: 'Deleted.' }
}
