'use server'

import { randomUUID } from 'crypto'
import { and, eq, isNull, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beginMutation, formErrorOf, insertOrFindExisting, required } from '@/lib/admin/mutation'
import { coinTypeHierarchyDescriptionSchema, coinTypeHierarchySchema, inscriptionSchema, stateSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { Db } from '@/lib/db'
import { coinTypeHierarchy, inscriptions, states } from '@/lib/db/schema'
import { slugify } from '@/lib/format'
import { COIN_TYPE_HIERARCHY_FIELDS, pick } from '@/lib/queries'
import type { CoinTypeHierarchyRow, Inscription, State } from '@/lib/types'

const STATE_FIELDS = pick(states, ['id', 'state_zh', 'state_en'] as const)
const INSCRIPTION_FIELDS = pick(inscriptions, ['id', 'inscription_zh', 'inscription_en'] as const)

async function selectHierarchyRow(db: Db, where: SQL | undefined): Promise<CoinTypeHierarchyRow | undefined> {
  return (await db.select(COIN_TYPE_HIERARCHY_FIELDS).from(coinTypeHierarchy).where(where).limit(1))[0]
}

/** The label this new row's own node would show — its deepest populated
 * level, English falling back to Chinese — same source buildCoinTypeNodes
 * reads for slug/label text (lib/coin-type-catalog.ts's zhOf/enOf), not the
 * separate name_zh/name_en columns. */
function deepestLevelLabel(parsed: {
  level1_zh: string | null
  level1_en: string | null
  level2_zh: string | null
  level2_en: string | null
  level3_zh: string | null
  level3_en: string | null
  level4_zh: string | null
  level4_en: string | null
  level5_zh: string | null
  level5_en: string | null
}): string {
  const levels = [5, 4, 3, 2, 1] as const
  for (const n of levels) {
    const zh = parsed[`level${n}_zh`]
    if (zh) return parsed[`level${n}_en`] ?? zh
  }
  return ''
}

/** Generates a type_code for a brand-new hierarchy node the same way
 * lib/coin-type-catalog.ts's buildCoinTypeNodes would derive one on the fly
 * for a codeless row, then checks it against type_code's own uniqueness —
 * same pattern as lib/admin/mints-actions.ts's generateMintCode for
 * mint_code. */
async function generateTypeCode(db: Db, parsed: Parameters<typeof deepestLevelLabel>[0]): Promise<string> {
  const base = slugify(deepestLevelLabel(parsed), 'type')
  let candidate = base
  let i = 2
  for (;;) {
    const [existing] = await db
      .select({ id: coinTypeHierarchy.id })
      .from(coinTypeHierarchy)
      .where(eq(coinTypeHierarchy.type_code, candidate))
      .limit(1)
    if (!existing) return candidate
    candidate = `${base}-${i}`
    i += 1
  }
}

/** Create-only — used exclusively by TaxonomyCombobox's "+ Add" popup in the
 * coin-issue form. Catches a unique-violation on state_zh (states.state_zh
 * has a unique constraint) and re-selects the existing row instead of
 * erroring. */
export async function createState(_prev: ActionState<State>, formData: FormData): Promise<ActionState<State>> {
  const begun = await beginMutation(stateSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const id = randomUUID()
  const selectState = async (where: SQL) => (await db.select(STATE_FIELDS).from(states).where(where).limit(1))[0]
  const result = await insertOrFindExisting<State>(
    async () => {
      await db.insert(states).values({ ...parsed, id })
      return required(await selectState(eq(states.id, id)))
    },
    () => selectState(eq(states.state_zh, parsed.state_zh)),
    'A state with this name already exists — using it.'
  )
  if (!result.ok) return result

  revalidatePath('/coin-types/[type_code]', 'page')
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

  const selectInscription = async (where: SQL) =>
    (await db.select(INSCRIPTION_FIELDS).from(inscriptions).where(where).limit(1))[0]
  const id = randomUUID()
  let data: Inscription
  try {
    if (parsed.inscription_zh) {
      const existing = await selectInscription(eq(inscriptions.inscription_zh, parsed.inscription_zh))
      if (existing) return { ok: true, data: existing, message: 'An inscription with this text already exists — using it.' }
    }

    // inscription_zh is NOT NULL in the table; a null still fails with the
    // database's own message, as before.
    await db.insert(inscriptions).values({ ...parsed, id } as typeof inscriptions.$inferInsert)
    data = required(await selectInscription(eq(inscriptions.id, id)))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/coin-types/[type_code]', 'page')
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

  const id = randomUUID()
  let type_code: string
  try {
    type_code = await generateTypeCode(db, parsed)
  } catch (err) {
    return formErrorOf(err)
  }
  const result = await insertOrFindExisting<CoinTypeHierarchyRow>(
    async () => {
      // name_zh/name_en are NOT NULL in the table; passed through as-is so a
      // missing one still fails with the database's own message.
      await db.insert(coinTypeHierarchy).values({ ...parsed, id, type_code } as typeof coinTypeHierarchy.$inferInsert)
      return required(await selectHierarchyRow(db, eq(coinTypeHierarchy.id, id)))
    },
    () =>
      // `col = NULL` never matches — use IS NULL for any level that's null so
      // the lookup mirrors the unique constraint.
      selectHierarchyRow(
        db,
        and(
          ...(['level1_zh', 'level2_zh', 'level3_zh', 'level4_zh', 'level5_zh'] as const).map((level) => {
            const value = parsed[level]
            return value == null ? isNull(coinTypeHierarchy[level]) : eq(coinTypeHierarchy[level], value)
          })
        )
      ),
    'A matching hierarchy node already exists — using it.'
  )
  if (!result.ok) return result

  revalidatePath('/coin-types/[type_code]', 'page')
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
  let data: CoinTypeHierarchyRow
  try {
    await db.update(coinTypeHierarchy).set(rest).where(eq(coinTypeHierarchy.id, id))
    data = required(await selectHierarchyRow(db, eq(coinTypeHierarchy.id, id)))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/coin-types/[type_code]', 'page')
  return { ok: true, data, message: 'Saved.' }
}
