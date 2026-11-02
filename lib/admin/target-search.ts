import { like, or, sql, type AnyColumn } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coinItems, contexts, finds, mints, sites } from '@/lib/db/schema'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

export type TargetType = 'site' | 'context' | 'find' | 'coin_item' | 'mint'

const RESULT_LIMIT = 20

/** Search-as-you-type lookup for AddSourceLinkForm's target picker. Read-only,
 * still routed through a gated 'use server' wrapper (target-search-action.ts)
 * for a uniform "nothing under lib/admin ever runs unauthorized" mental model. */
/** Case-insensitive `col LIKE pattern` — the tables use a binary (case-
 * sensitive) collation, so both sides are lowercased, matching the old ilike. */
function ilike(col: AnyColumn, pattern: string) {
  return like(sql`lower(${col})`, pattern.toLowerCase())
}

export async function searchTargets(targetType: TargetType, query: string): Promise<ComboOption[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const q = `%${trimmed}%`

  switch (targetType) {
    case 'site': {
      const data = await db
        .select({ site_code: sites.site_code, site_name_zh: sites.site_name_zh })
        .from(sites)
        .where(or(ilike(sites.site_code, q), ilike(sites.site_name_zh, q)))
        .limit(RESULT_LIMIT)
      return data.map((r) => ({ value: r.site_code, label: `${r.site_code} · ${r.site_name_zh ?? ''}` }))
    }
    case 'context': {
      const data = await db
        .select({ context_code: contexts.context_code, context_name_zh: contexts.context_name_zh })
        .from(contexts)
        .where(or(ilike(contexts.context_code, q), ilike(contexts.context_name_zh, q)))
        .limit(RESULT_LIMIT)
      return data.map((r) => ({
        value: r.context_code,
        label: `${r.context_code} · ${r.context_name_zh ?? ''}`,
      }))
    }
    case 'find': {
      const data = await db.select({ find_code: finds.find_code }).from(finds).where(ilike(finds.find_code, q)).limit(RESULT_LIMIT)
      return data.map((r) => ({ value: r.find_code, label: r.find_code }))
    }
    case 'coin_item': {
      const data = await db
        .select({ coin_item_code: coinItems.coin_item_code, description_zh: coinItems.description_zh })
        .from(coinItems)
        .where(or(ilike(coinItems.coin_item_code, q), ilike(coinItems.description_zh, q)))
        .limit(RESULT_LIMIT)
      return data.map((r) => ({
        value: r.coin_item_code,
        label: r.description_zh ? `${r.coin_item_code} · ${r.description_zh}` : r.coin_item_code,
      }))
    }
    case 'mint': {
      // mint_code is a generated URL slug, not a natural business code like
      // the other target types' — still the right join key since it's what
      // resolveSourceLinkTargets uses to build /mints/[mint_code] hrefs.
      const data = await db
        .select({ mint_code: mints.mint_code, name_zh: mints.name_zh, name_en: mints.name_en })
        .from(mints)
        .where(or(ilike(mints.mint_code, q), ilike(mints.name_zh, q), ilike(mints.name_en, q)))
        .limit(RESULT_LIMIT)
      return data.map((r) => ({
        value: r.mint_code,
        label: `${r.mint_code} · ${r.name_zh ?? r.name_en ?? ''}`,
      }))
    }
  }
}
