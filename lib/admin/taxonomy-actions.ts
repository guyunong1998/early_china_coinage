'use server'

import { revalidatePath } from 'next/cache'
import { assertAuthorized, getWriteClient } from '@/lib/admin/guard'
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
  await assertAuthorized()
  const db = await getWriteClient()
  const parsed = stateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const { data, error } = await db.from('states').insert(parsed.data).select('id, state_zh, state_en').single()
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: selectError } = await db
        .from('states')
        .select('id, state_zh, state_en')
        .eq('state_zh', parsed.data.state_zh)
        .single()
      if (selectError) return { ok: false, formError: selectError.message }
      return { ok: true, data: existing, message: 'A state with this name already exists — using it.' }
    }
    return { ok: false, formError: error.message }
  }

  revalidatePath('/coin-types/[slug]', 'page')
  return { ok: true, data, message: 'Created.' }
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
  await assertAuthorized()
  const db = await getWriteClient()
  const parsed = inscriptionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  if (parsed.data.inscription_zh) {
    const { data: existing, error: selectError } = await db
      .from('inscriptions')
      .select('id, inscription_zh, inscription_en')
      .eq('inscription_zh', parsed.data.inscription_zh)
      .maybeSingle()
    if (selectError) return { ok: false, formError: selectError.message }
    if (existing) return { ok: true, data: existing, message: 'An inscription with this text already exists — using it.' }
  }

  const { data, error } = await db
    .from('inscriptions')
    .insert(parsed.data)
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
  await assertAuthorized()
  const db = await getWriteClient()
  const parsed = coinTypeHierarchySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const { data, error } = await db.from('coin_type_hierarchy').insert(parsed.data).select(HIERARCHY_FIELDS).single()
  if (error) {
    if (error.code === '23505') {
      // .eq(col, null) doesn't match NULL rows in PostgREST — use .is() for
      // any level that's null so the lookup mirrors the unique constraint.
      let query = db.from('coin_type_hierarchy').select(HIERARCHY_FIELDS)
      for (const level of ['level1_zh', 'level2_zh', 'level3_zh', 'level4_zh', 'level5_zh'] as const) {
        const value = parsed.data[level]
        query = value == null ? query.is(level, null) : query.eq(level, value)
      }
      const { data: existing, error: selectError } = await query.single()
      if (selectError) return { ok: false, formError: selectError.message }
      return { ok: true, data: existing, message: 'A matching hierarchy node already exists — using it.' }
    }
    return { ok: false, formError: error.message }
  }

  revalidatePath('/coin-types/[slug]', 'page')
  revalidatePath('/coin-types')
  return { ok: true, data, message: 'Created.' }
}

/** Edits an existing typology node's description (coin-types detail page's
 * Description section) — the node's "own row" (see lib/coin-type-catalog.ts
 * ownRow/ownImgAccNum), not a new row. */
export async function updateCoinTypeHierarchyDescription(
  _prev: ActionState<CoinTypeHierarchyRow>,
  formData: FormData
): Promise<ActionState<CoinTypeHierarchyRow>> {
  await assertAuthorized()
  const db = await getWriteClient()
  const parsed = coinTypeHierarchyDescriptionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }

  const { id, ...rest } = parsed.data
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
