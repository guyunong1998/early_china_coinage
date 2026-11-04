import { supabase } from '@/lib/supabase'
import type { SourceLink } from '@/lib/types'

export type ResolvedTarget = { label: string; href: string | null; missing?: boolean }

function key(targetType: string, targetCode: string): string {
  return `${targetType}:${targetCode}`
}

// PostgREST's .in() filter is serialized into the request URL's query
// string — with 1000+ codes (the /sources page resolves all 4,426
// source_links at once) that overflows undici's ~16KB header limit. Chunk
// every batched lookup below to stay well under it.
const BATCH_SIZE = 150

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}

/**
 * Resolves each (target_type, target_code) pair to a human-readable label +
 * the one public URL that type can link to, via the v_coin_issues_flat-style
 * `v_source_link_targets` view (one UNION ALL catalog covering site/context/
 * find/coin_item/mint, replacing what used to be five separate hand-joined
 * queries here). Still one query per target_type — the view is keyed by
 * (target_type, target_code) together, and PostgREST has no composite `.in()`
 * — chunked the same way as before to stay under the request-size limit.
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
      const batches = await Promise.all(
        chunk(codes, BATCH_SIZE).map(async (batch) => {
          const { data, error } = await supabase
            .from('v_source_link_targets')
            .select('target_code, label, href')
            .eq('target_type', targetType)
            .in('target_code', batch)
          if (error) throw error
          return data ?? []
        })
      )
      batches.flat().forEach((row) => {
        result.set(key(targetType, row.target_code), { label: row.label, href: row.href })
      })
    })
  )

  links.forEach((l) => {
    const k = key(l.target_type, l.target_code)
    if (!result.has(k)) result.set(k, { label: l.target_code, href: null, missing: true })
  })

  return result
}
