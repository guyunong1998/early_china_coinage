import { fetchAllPages } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { AnsSpecimen } from '@/lib/pointed-spade-data'

type MintEmbed = { name_zh: string; name_en: string | null }
type StateEmbed = { state_zh: string; state_en: string | null }

type AnsDataRow = {
  id: string
  catalog_number: string | null
  inscription_raw: string | null
  reverse_inscription: string | null
  hierarchy_id: string | null
  inscription_id: string | null
  mints: MintEmbed | MintEmbed[] | null
  states: StateEmbed | StateEmbed[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Every specimen in the reconciled `public.ans_data` table (see
 * scripts/reconcile-ans-data.sql), with mint/state resolved via their FKs.
 * Powers the Museum Collections page: the mint-town map
 * (lib/pointed-spade-data.ts's computeAnsMintStats) and the accession-number
 * search box both read from this same fetch.
 */
export async function getAnsSpecimens(): Promise<AnsSpecimen[]> {
  const rows = await fetchAllPages<AnsDataRow>((from, to) =>
    supabase
      .from('ans_data')
      .select(
        'id, catalog_number, inscription_raw, reverse_inscription, hierarchy_id, inscription_id, mints(name_zh, name_en), states(state_zh, state_en)'
      )
      .order('catalog_number')
      .range(from, to)
  )

  return rows.map((row) => {
    const mint = one(row.mints)
    const state = one(row.states)
    return {
      id: row.id,
      catalog_number: row.catalog_number,
      inscription_raw: row.inscription_raw,
      reverse_inscription: row.reverse_inscription,
      hierarchy_id: row.hierarchy_id,
      inscription_id: row.inscription_id,
      mint_zh: mint?.name_zh ?? null,
      mint_en: mint?.name_en ?? null,
      state_zh: state?.state_zh ?? null,
      state_en: state?.state_en ?? null,
    }
  })
}
