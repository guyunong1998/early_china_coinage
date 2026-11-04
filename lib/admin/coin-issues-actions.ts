'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beginMutation, formErrorOf, required } from '@/lib/admin/mutation'
import { coinIssueSchema } from '@/lib/admin/schemas'
import { coinIssues } from '@/lib/db/schema'
import { flattenCoinIssue, selectCoinIssueEmbeds, type CoinIssueEmbed } from '@/lib/queries'
import type { ActionState } from '@/lib/admin/types'
import type { CoinIssueDisplay } from '@/lib/types'

/** No create/delete — editing existing coin_issues rows only, confirmed
 * explicitly out of scope for adding new ones anywhere in this feature. */
export async function updateCoinIssue(
  _prev: ActionState<CoinIssueDisplay>,
  formData: FormData
): Promise<ActionState<CoinIssueDisplay>> {
  const begun = await beginMutation(coinIssueSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const { id, ...rest } = parsed
  let data: CoinIssueEmbed
  try {
    await db.update(coinIssues).set(rest).where(eq(coinIssues.id, id))
    data = required((await selectCoinIssueEmbeds().where(eq(coinIssues.id, id)))[0]) as CoinIssueEmbed
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/coin-types/[type_code]', 'page')
  revalidatePath('/coin-types')
  return { ok: true, data: flattenCoinIssue(data), message: 'Saved.' }
}
