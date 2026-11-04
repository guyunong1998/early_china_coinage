import { asc } from 'drizzle-orm'
import { readDb } from '@/lib/db'
import { vAnsFlat } from '@/lib/db/schema'
import type { AnsSpecimen } from '@/lib/mint-stats'

/**
 * Every specimen in the reconciled `ans_data` table (see
 * scripts/reconcile-ans-data.sql), with mint/state resolved via
 * `v_ans_flat` (scripts/add-ans-flat-view.sql) instead of an embedded join.
 * Powers the Museum Collections page: the mint-town map
 * (lib/mint-stats.ts's computeAnsMintStats) and the accession-number
 * search box both read from this same fetch.
 */
export async function getAnsSpecimens(): Promise<AnsSpecimen[]> {
  return readDb.select().from(vAnsFlat).orderBy(asc(vAnsFlat.catalog_number))
}
