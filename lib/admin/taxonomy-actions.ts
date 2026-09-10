'use server'

import { revalidatePath } from 'next/cache'
import { beginMutation, insertOrFindExisting } from '@/lib/admin/mutation'
import { coinTypeHierarchyDescriptionSchema, coinTypeHierarchySchema, inscriptionSchema, stateSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { CoinTypeHierarchyRow, Inscription, State } from '@/lib/types'

const HIERARCHY_FIELDS =
  'id, level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en, img_acc_num, description_zh, description_en'

/** Create-only — used exclusively by TaxonomyCombobox's "+ Add" popup in the
 * coin-issue form. Catches a unique-violation on state_zh (states.state_zh
 * has a unique constraint) and re-selects the existing row instead of
 * erroring. */
export async function createState(_prev: ActionState<State>, formData: FormData): Promise<ActionState<State>> {
  const begun = await beginMutation(stateSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const result = await insertOrFindExisting<State>(
    () => db.from('states').insert(parsed).select('id, state_zh, state_en').single(),
    () => db.from('states').select('id, state_zh, state_en').eq('state_zh', parsed.state_zh).single(),
    'A state with this name already exists — using it.'
  )
  if (!result.ok) return result

  revalidatePath('/coin-types/[slug]', 'page')
  return { ok: true, data: result.data, message: result.message }
}

/**
 * `inscriptions` has no unique constraint to lean on, so this pre-checks by
 * exact match on inscription_zh before inserting, rather than catching a
 * unique-violation like the other three quick-create actions.
 */
export async function createInscription(
  _prev: ActionState<Inscription>,
  formData: FormData
): Promise<ActionState<Inscription>> {
  const begun = await beginMutation(inscriptionSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  if (parsed.inscription_zh) {
    const { data: existing, error: selectError } = await db
      .from('inscriptions')
      .select('id, inscription_zh, inscription_en')
      .eq('inscription_zh', parsed.inscription_zh)
      .maybeSingle()
    if (selectError) return { ok: false, formError: selectError.message }
    if (existing) return { ok: true, data: existing, message: 'An inscription with this text already exists — using it.' }
  }

  const { data, error } = await db
    .from('inscriptions')
    .insert(parsed)
    .select('id, inscription_zh, inscription_en')
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/coin-types/[slug]', 'page')
  return { ok: true, data, message: 'Created.' }
}

/** Catches a unique-violation on the (level1_zh..level5_zh) composite key. */
export async function createCoinTypeHierarchy(
  _prev: ActionState<CoinTypeHierarchyRow>,
  formData: FormData
): Promise<ActionState<CoinTypeHierarchyRow>> {
  const begun = await beginMutation(coinTypeHierarchySchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const result = await insertOrFindExisting<CoinTypeHierarchyRow>(
    () => db.from('coin_type_hierarchy').insert(parsed).select(HIERARCHY_FIELDS).single(),
    () => {
      // .eq(col, null) doesn't match NULL rows in PostgREST — use .is() for
      // any level that's null so the lookup mirrors the unique constraint.
      let query = db.from('coin_type_hierarchy').select(HIERARCHY_FIELDS)
      for (const level of ['level1_zh', 'level2_zh', 'level3_zh', 'level4_zh', 'level5_zh'] as const) {
        const value = parsed[level]
        query = value == null ? query.is(level, null) : query.eq(level, value)
      }
      return query.single()
    },
    'A matching hierarchy node already exists — using it.'
  )
  if (!result.ok) return result

  revalidatePath('/coin-types/[slug]', 'page')
  revalidatePath('/coin-types')
  return { ok: true, data: result.data, message: result.message }
}

/** Edits an existing typology node's description (coin-types detail page's
 * Description section) — the node's "own row" (see lib/coin-type-catalog.ts
 * ownRow/ownImgAccNum), not a new row. */
export async function updateCoinTypeHierarchyDescription(
  _prev: ActionState<CoinTypeHierarchyRow>,
  formData: FormData
): Promise<ActionState<CoinTypeHierarchyRow>> {
  const begun = await beginMutation(coinTypeHierarchyDescriptionSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const { id, ...rest } = parsed
  const { data, error } = await db
    .from('coin_type_hierarchy')
    .update(rest)
    .eq('id', id)
    .select(HIERARCHY_FIELDS)
    .single()
  if (error) return { ok: false, formError: error.message }

  revalidatePath('/coin-types/[slug]', 'page')
  return { ok: true, data, message: 'Saved.' }
}
