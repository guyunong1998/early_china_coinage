'use server'

import { revalidatePath } from 'next/cache'
import type { getWriteClient } from '@/lib/admin/guard'
import { beginMutation, insertOrFindExisting } from '@/lib/admin/mutation'
import { createMintSchema, mintSchema } from '@/lib/admin/schemas'
import type { ActionState } from '@/lib/admin/types'
import { slugify } from '@/lib/format'
import { toEnglishName } from '@/lib/name-translation'
import type { Mint } from '@/lib/types'

const MINT_FIELDS =
  'id, name_zh, name_en, precision_level, latitude, longitude, description_zh, description_en, citation, state_id, modern_location_zh, modern_location_en, location_note, image_ids, sources_unlinked, mint_code, alternative_names'

/** Generates a mint_code for a brand-new mint the same way lib/mint-directory.ts
 * would derive one on the fly for a codeless row, then checks it against
 * mint_code's own uniqueness (not just the in-memory `used` set that page
 * render builds up) — numbering upward past any collision. */
async function generateMintCode(
  db: Awaited<ReturnType<typeof getWriteClient>>,
  nameZh: string,
  nameEn: string | null
): Promise<string> {
  const base = slugify(toEnglishName(nameZh, nameEn) || nameZh, 'mint')
  let candidate = base
  let i = 2
  for (;;) {
    const { data } = await db.from('mints').select('id').eq('mint_code', candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${i}`
    i += 1
  }
}

export async function updateMint(_prev: ActionState<Mint>, formData: FormData): Promise<ActionState<Mint>> {
  const begun = await beginMutation(mintSchema, formData)
  if (!begun.ok) return begun.result
  const { db, data: parsed } = begun

  const { id, ...rest } = parsed
  const { data, error } = await db
    .from('mints')
    .update(rest)
    .eq('id', id)
    .select(MINT_FIELDS)
    .single()

  if (error) return { ok: false, formError: error.message }

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

  const mint_code = await generateMintCode(db, parsed.name_zh, parsed.name_en)
  const result = await insertOrFindExisting<Mint>(
    () => db.from('mints').insert({ ...parsed, mint_code }).select(MINT_FIELDS).single(),
    () => db.from('mints').select(MINT_FIELDS).eq('name_zh', parsed.name_zh).single(),
    'A mint with this name already exists — using it.'
  )
  if (!result.ok) return result

  revalidatePath('/mints')
  return { ok: true, data: result.data, message: result.message }
}
