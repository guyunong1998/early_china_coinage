'use server'

import { revalidatePath } from 'next/cache'
import { assertAuthorized, getWriteClient } from '@/lib/admin/guard'
import { coinIssueSchema } from '@/lib/admin/schemas'
import { COIN_ISSUE_FIELDS, flattenCoinIssue, type CoinIssueEmbed } from '@/lib/queries'
import type { ActionState } from '@/lib/admin/types'
import type { CoinIssueDisplay } from '@/lib/types'

/** No create/delete — editing existing coin_issues rows only, confirmed
 * explicitly out of scope for adding new ones anywhere in this feature. */
export async function updateCoinIssue(
  _prev: ActionState<CoinIssueDisplay>,
  formData: FormData
): Promise<ActionState<CoinIssueDisplay>> {
  await assertAuthorized()
  const db = await getWriteClient()
  const parsed = coinIssueSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const { id, ...rest } = parsed.data
  const { data, error } = await db
    .from('coin_issues')
    .update(rest)
    .eq('id', id)
    .select(COIN_ISSUE_FIELDS)
    .single()

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/coin-types/[slug]', 'page')
  revalidatePath('/coin-types')
  return { ok: true, data: flattenCoinIssue(data as CoinIssueEmbed), message: 'Saved.' }
}
