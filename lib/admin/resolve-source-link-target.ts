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

/** Runs `queryBatch` once per chunk of `codes` (in parallel) and concatenates the results. */
async function fetchInBatches<T>(codes: string[], queryBatch: (batch: string[]) => Promise<T[]>): Promise<T[]> {
  const batches = await Promise.all(chunk(codes, BATCH_SIZE).map(queryBatch))
  return batches.flat()
}

/**
 * Batches one query per target_type across every link passed in (not N+1
 * per link, and chunked to stay under PostgREST's request-size limit) and
 * resolves each to a human-readable label + the one public URL that type can
 * link to. `target_code` isn't a real FK (the target table varies by
 * target_type), so a code with a typo or an orphaned reference simply won't
 * resolve — callers should render `missing` links as plain muted text
 * instead of a broken href.
 */
export async function resolveSourceLinkTargets(
  links: Pick<SourceLink, 'target_type' | 'target_code'>[]
): Promise<Map<string, ResolvedTarget>> {
  const result = new Map<string, ResolvedTarget>()

  const codesByType = {
    site: [...new Set(links.filter((l) => l.target_type === 'site').map((l) => l.target_code))],
    context: [...new Set(links.filter((l) => l.target_type === 'context').map((l) => l.target_code))],
    find: [...new Set(links.filter((l) => l.target_type === 'find').map((l) => l.target_code))],
    coin_item: [...new Set(links.filter((l) => l.target_type === 'coin_item').map((l) => l.target_code))],
    mint: [...new Set(links.filter((l) => l.target_type === 'mint').map((l) => l.target_code))],
  }

  if (codesByType.site.length > 0) {
    const rows = await fetchInBatches(codesByType.site, async (batch) => {
      const { data, error } = await supabase.from('sites').select('site_code, site_name_zh').in('site_code', batch)
      if (error) throw error
      return data ?? []
    })
    rows.forEach((row) => {
      result.set(key('site', row.site_code), {
        label: row.site_name_zh ? `${row.site_code} · ${row.site_name_zh}` : row.site_code,
        href: `/sites/${row.site_code}`,
      })
    })
  }

  if (codesByType.context.length > 0) {
    const rows = await fetchInBatches(codesByType.context, async (batch) => {
      const { data, error } = await supabase
        .from('contexts')
        .select('context_code, context_name_zh, site_code')
        .in('context_code', batch)
      if (error) throw error
      return data ?? []
    })
    rows.forEach((row) => {
      result.set(key('context', row.context_code), {
        label: row.context_name_zh ? `${row.context_code} · ${row.context_name_zh}` : row.context_code,
        href: `/sites/${row.site_code}`,
      })
    })
  }

  if (codesByType.find.length > 0) {
    const rows = await fetchInBatches(codesByType.find, async (batch) => {
      const { data, error } = await supabase
        .from('finds')
        .select('find_code, context_code, contexts!inner(site_code)')
        .in('find_code', batch)
      if (error) throw error
      return (data ?? []) as Array<{
        find_code: string
        context_code: string
        contexts: { site_code: string } | { site_code: string }[]
      }>
    })
    rows.forEach((row) => {
      const context = Array.isArray(row.contexts) ? row.contexts[0] : row.contexts
      if (!context) return
      result.set(key('find', row.find_code), { label: row.find_code, href: `/sites/${context.site_code}` })
    })
  }

  if (codesByType.coin_item.length > 0) {
    const rows = await fetchInBatches(codesByType.coin_item, async (batch) => {
      const { data, error } = await supabase
        .from('coin_items')
        .select('coin_item_code, description_zh, finds!inner(context_code, contexts!inner(site_code))')
        .in('coin_item_code', batch)
      if (error) throw error
      return (data ?? []) as Array<{
        coin_item_code: string
        description_zh: string | null
        finds:
          | { contexts: { site_code: string } | { site_code: string }[] }
          | { contexts: { site_code: string } | { site_code: string }[] }[]
      }>
    })
    rows.forEach((row) => {
      const find = Array.isArray(row.finds) ? row.finds[0] : row.finds
      const context = find ? (Array.isArray(find.contexts) ? find.contexts[0] : find.contexts) : null
      if (!context) return
      result.set(key('coin_item', row.coin_item_code), {
        label: row.description_zh ? `${row.coin_item_code} · ${row.description_zh}` : row.coin_item_code,
        href: `/sites/${context.site_code}`,
      })
    })
  }

  if (codesByType.mint.length > 0) {
    const rows = await fetchInBatches(codesByType.mint, async (batch) => {
      const { data, error } = await supabase.from('mints').select('mint_code, name_zh').in('mint_code', batch)
      if (error) throw error
      return data ?? []
    })
    rows.forEach((row) => {
      result.set(key('mint', row.mint_code), {
        label: row.name_zh ? `${row.mint_code} · ${row.name_zh}` : row.mint_code,
        href: `/mints/${row.mint_code}`,
      })
    })
  }

  links.forEach((l) => {
    const k = key(l.target_type, l.target_code)
    if (!result.has(k)) result.set(k, { label: l.target_code, href: null, missing: true })
  })

  return result
}
