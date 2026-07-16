'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { SortOption } from '@/lib/search-filters'

const OPTIONS: { value: SortOption; labelKey: DictionaryKey }[] = [
  { value: 'name', labelKey: 'search.sort.name' },
  { value: 'quantity', labelKey: 'search.sort.quantity' },
  { value: 'province', labelKey: 'search.sort.province' },
  { value: 'finds', labelKey: 'search.sort.finds' },
  { value: 'coinTypes', labelKey: 'search.sort.coinTypes' },
  { value: 'states', labelKey: 'search.sort.states' },
]

/** Lives inside the surrounding filter `<form>` so changing it resubmits the
 * whole GET form (preserving every other filter) without any client routing. */
export function SortSelect({ value }: { value: SortOption }) {
  const { t } = useLanguage()

  return (
    <label className="flex items-center gap-2 text-xs text-gray-600">
      <span className="font-semibold uppercase tracking-wide text-gray-500">{t('search.sortBy')}</span>
      <select
        name="sort"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </label>
  )
}
