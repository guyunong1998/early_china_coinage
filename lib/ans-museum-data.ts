import { fetchAllPages } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { AnsSpecimen } from '@/lib/mint-stats'

/**
 * Every specimen in the reconciled `public.ans_data` table (see
 * scripts/reconcile-ans-data.sql), with mint/state resolved via
 * `v_ans_flat` (scripts/add-ans-flat-view.sql) instead of an embedded join.
 * Powers the Museum Collections page: the mint-town map
 * (lib/mint-stats.ts's computeAnsMintStats) and the accession-number
 * search box both read from this same fetch.
 */
export async function getAnsSpecimens(): Promise<AnsSpecimen[]> {
  return fetchAllPages<AnsSpecimen>((from, to) =>
    supabase
      .from('v_ans_flat')
      .select(
        'id, catalog_number, level1_zh, level1_en, level2_zh, level2_en, level3_zh, level3_en, level4_zh, level4_en, level5_zh, level5_en, inscription_zh, inscription_en, mint_zh, mint_en, state_zh, state_en'
      )
      .order('catalog_number')
      .range(from, to)
  )
}
