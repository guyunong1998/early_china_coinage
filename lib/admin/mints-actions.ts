'use server'

import { randomUUID } from 'crypto'
import { eq, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { beginMutation, formErrorOf, insertOrFindExisting, required } from '@/lib/admin/mutation'
import { createMintSchema, mintSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import type { Db } from '@/lib/db'
import { mints } from '@/lib/db/schema'
import { slugify } from '@/lib/format'
import { toEnglishName } from '@/lib/name-translation'
import { pick } from '@/lib/queries'
import type { Mint } from '@/lib/types'

const MINT_FIELDS = pick(mints, [
  'id', 'name_zh', 'name_en', 'precision_level', 'latitude', 'longitude', 'description_zh', 'description_en', 'citation',
  'state_id', 'modern_location_zh', 'modern_location_en', 'location_note', 'image_ids', 'sources_unlinked', 'mint_code',
  'alternative_names',
] as const)

async function selectMint(db: Db, where: SQL): Promise<Mint | undefined> {
  return (await db.select(MINT_FIELDS).from(mints).where(where).limit(1))[0]
}

/** Generates a mint_code for a brand-new mint the same way lib/mint-directory.ts
 * would derive one on the fly for a codeless row, then checks it against
 * mint_code's own uniqueness (not just the in-memory `used` set that page
 * render builds up) — numbering upward past any collision. */
async function generateMintCode(db: Db, nameZh: string, nameEn: string | null): Promise<string> {
  const base = slugify(toEnglishName(nameZh, nameEn) || nameZh, 'mint')
  let candidate = base
  let i = 2
  for (;;) {
    const [existing] = await db.select({ id: mints.id }).from(mints).where(eq(mints.mint_code, candidate)).limit(1)
    if (!existing) return candidate
    candidate = `${base}-${i}`
    i += 1
  }
}

export async function updateMint(_prev: ActionState<Mint>, formData: FormData): Promise<ActionState<Mint>> {
  const begun = await beginMutation(mintSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const { id, ...rest } = parsed
  let data: Mint
  try {
    await db.update(mints).set(rest).where(eq(mints.id, id))
    data = required(await selectMint(db, eq(mints.id, id)))
  } catch (err) {
    return formErrorOf(err)
  }

  revalidatePath('/mints')
  revalidatePath(`/mints/${encodeURIComponent(data.name_zh)}`)
  return { ok: true, data, message: 'Saved.' }
}

/**
 * Used both by /mints' "+ Add mint" affordance and the coin-issue mint
 * combobox's "+ Add" popup — one action, two callers. Catches a unique-
 * violation on name_zh (mints.name_zh has a unique constraint) and re-
 * selects the existing row instead of erroring, so picking an
 * already-catalogued mint name by accident just resolves to that mint.
 */
export async function createMint(_prev: ActionState<Mint>, formData: FormData): Promise<ActionState<Mint>> {
  const begun = await beginMutation(createMintSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const id = randomUUID()
  let mint_code: string
  try {
    mint_code = await generateMintCode(db, parsed.name_zh, parsed.name_en)
  } catch (err) {
    return formErrorOf(err)
  }
  const result = await insertOrFindExisting<Mint>(
    async () => {
      // image_ids passed explicitly: the migrated column default is '{}' (an
      // empty JSON object, carried over from Postgres's empty-array literal).
      await db.insert(mints).values({ ...parsed, id, mint_code, image_ids: [] })
      return required(await selectMint(db, eq(mints.id, id)))
    },
    () => selectMint(db, eq(mints.name_zh, parsed.name_zh)),
    'A mint with this name already exists — using it.'
  )
  if (!result.ok) return result

  revalidatePath('/mints')
  return { ok: true, data: result.data, message: result.message }
}
