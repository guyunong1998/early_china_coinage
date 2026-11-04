import { supabase } from '@/lib/supabase'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

export type TargetType = 'site' | 'context' | 'find' | 'coin_item' | 'mint'

const RESULT_LIMIT = 20

/** Search-as-you-type lookup for AddSourceLinkForm's target picker. Read-only
 * (uses the plain anon client — SELECT is public on every table already), so
 * this is safe to call without the service-role client; it's still routed
 * through a dev-gated 'use server' wrapper (target-search-action.ts) for a
 * uniform "nothing under lib/admin ever runs in prod" mental model. */
/** Escapes a value for interpolation into a PostgREST .or() filter string,
 * where `,`, `.`, `(`, `)` are syntax (e.g. a comma in the search text would
 * otherwise be read as a separate filter clause). Backslash-escaping the
 * value and wrapping it in double quotes makes PostgREST treat it literally. */
function toOrFilterPattern(raw: string): string {
  const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"%${escaped}%"`
}

export async function searchTargets(targetType: TargetType, query: string): Promise<ComboOption[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const q = `%${trimmed}%`
  const orQ = toOrFilterPattern(trimmed)

  switch (targetType) {
    case 'site': {
      const { data, error } = await supabase
        .from('sites')
        .select('site_code, site_name_zh')
        .or(`site_code.ilike.${orQ},site_name_zh.ilike.${orQ}`)
        .limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({ value: r.site_code, label: `${r.site_code} · ${r.site_name_zh ?? ''}` }))
    }
    case 'context': {
      const { data, error } = await supabase
        .from('contexts')
        .select('context_code, context_name_zh')
        .or(`context_code.ilike.${orQ},context_name_zh.ilike.${orQ}`)
        .limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({
        value: r.context_code,
        label: `${r.context_code} · ${r.context_name_zh ?? ''}`,
      }))
    }
    case 'find': {
      const { data, error } = await supabase.from('finds').select('find_code').ilike('find_code', q).limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({ value: r.find_code, label: r.find_code }))
    }
    case 'coin_item': {
      const { data, error } = await supabase
        .from('coin_items')
        .select('coin_item_code, description_zh')
        .or(`coin_item_code.ilike.${orQ},description_zh.ilike.${orQ}`)
        .limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({
        value: r.coin_item_code,
        label: r.description_zh ? `${r.coin_item_code} · ${r.description_zh}` : r.coin_item_code,
      }))
    }
    case 'mint': {
      // mint_code is a generated URL slug, not a natural business code like
      // the other target types' — still the right join key since it's what
      // resolveSourceLinkTargets uses to build /mints/[mint_code] hrefs.
      const { data, error } = await supabase
        .from('mints')
        .select('mint_code, name_zh, name_en')
        .or(`mint_code.ilike.${orQ},name_zh.ilike.${orQ},name_en.ilike.${orQ}`)
        .limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({
        value: r.mint_code,
        label: `${r.mint_code} · ${r.name_zh ?? r.name_en ?? ''}`,
      }))
    }
  }
}
