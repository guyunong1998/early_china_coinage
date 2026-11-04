'use server'

import { assertAuthorized } from '@/lib/admin/guard'
import { resolveSourceLinkTargets, type ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { SourceLink } from '@/lib/types'

/** Client-callable wrapper (the database pool is server-only), used right
 * after an admin adds a citation. Entries rather than a Map for transport. */
export async function resolveSourceLinkTargetsAction(
  links: Pick<SourceLink, 'target_type' | 'target_code'>[]
): Promise<[string, ResolvedTarget][]> {
  await assertAuthorized()
  return [...(await resolveSourceLinkTargets(links))]
}
