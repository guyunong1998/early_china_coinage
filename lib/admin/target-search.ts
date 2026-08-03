import { supabase } from '@/lib/supabase'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

export type TargetType = 'site' | 'context' | 'find' | 'coin_item'

const RESULT_LIMIT = 20

/** Search-as-you-type lookup for AddSourceLinkForm's target picker. Read-only
 * (uses the plain anon client — SELECT is public on every table already), so
 * this is safe to call without the service-role client; it's still routed
 * through a dev-gated 'use server' wrapper (target-search-action.ts) for a
 * uniform "nothing under lib/admin ever runs in prod" mental model. */
export async function searchTargets(targetType: TargetType, query: string): Promise<ComboOption[]> {
  const q = `%${query.trim()}%`
  if (!query.trim()) return []

  switch (targetType) {
    case 'site': {
      const { data, error } = await supabase
        .from('sites')
        .select('site_code, site_name_zh')
        .or(`site_code.ilike.${q},site_name_zh.ilike.${q}`)
        .limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({ value: r.site_code, label: `${r.site_code} · ${r.site_name_zh ?? ''}` }))
    }
    case 'context': {
      const { data, error } = await supabase
        .from('contexts')
        .select('context_code, context_name_zh')
        .or(`context_code.ilike.${q},context_name_zh.ilike.${q}`)
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
        .or(`coin_item_code.ilike.${q},description_zh.ilike.${q}`)
        .limit(RESULT_LIMIT)
      if (error) throw error
      return (data ?? []).map((r) => ({
        value: r.coin_item_code,
        label: r.description_zh ? `${r.coin_item_code} · ${r.description_zh}` : r.coin_item_code,
      }))
    }
  }
}
