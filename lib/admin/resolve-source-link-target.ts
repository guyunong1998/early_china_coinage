import { and, eq, inArray } from 'drizzle-orm'
import { readDb } from '@/lib/db'
import { vSourceLinkTargets } from '@/lib/db/schema'
import type { SourceLink } from '@/lib/types'

export type ResolvedTarget = { label: string; href: string | null; missing?: boolean }

function key(targetType: string, targetCode: string): string {
  return `${targetType}:${targetCode}`
}

/**
 * Resolves each (target_type, target_code) pair to a human-readable label +
 * the one public URL that type can link to, via the v_coin_issues_flat-style
 * `v_source_link_targets` view (one UNION ALL catalog covering site/context/
 * find/coin_item/mint, replacing what used to be five separate hand-joined
 * queries here). One query per target_type, since the view is keyed by
 * (target_type, target_code) together. (The /sources page resolves all 4,426
 * source_links at once — fine as bound parameters, unlike the old PostgREST
 * URL-encoded `.in()`, which had to be chunked.)
 * `target_code` isn't a real FK (the target table varies by target_type), so
 * a code with a typo or an orphaned reference simply won't resolve — callers
 * should render `missing` links as plain muted text instead of a broken href.
 */
export async function resolveSourceLinkTargets(
  links: Pick<SourceLink, 'target_type' | 'target_code'>[]
): Promise<Map<string, ResolvedTarget>> {
  const result = new Map<string, ResolvedTarget>()

  const codesByType = new Map<string, string[]>()
  links.forEach((l) => {
    if (!codesByType.has(l.target_type)) codesByType.set(l.target_type, [])
    codesByType.get(l.target_type)!.push(l.target_code)
  })

  await Promise.all(
    [...codesByType.entries()].map(async ([targetType, rawCodes]) => {
      const codes = [...new Set(rawCodes)]
      const rows = await readDb
        .select({ target_code: vSourceLinkTargets.target_code, label: vSourceLinkTargets.label, href: vSourceLinkTargets.href })
        .from(vSourceLinkTargets)
        .where(and(eq(vSourceLinkTargets.target_type, targetType), inArray(vSourceLinkTargets.target_code, codes)))
      rows.forEach((row) => {
        result.set(key(targetType, row.target_code), { label: row.label ?? row.target_code, href: row.href })
      })
    })
  )

  links.forEach((l) => {
    const k = key(l.target_type, l.target_code)
    if (!result.has(k)) result.set(k, { label: l.target_code, href: null, missing: true })
  })

  return result
}
