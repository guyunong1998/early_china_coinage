'use server'

import { assertAuthorized } from '@/lib/admin/guard'
import { searchTargets, type TargetType } from '@/lib/admin/target-search'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

export async function searchTargetsAction(targetType: TargetType, query: string): Promise<ComboOption[]> {
  await assertAuthorized()
  return searchTargets(targetType, query)
}
