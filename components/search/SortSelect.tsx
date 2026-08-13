'use client'

import { ClickHint } from '@/components/ui/ClickHint'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { SortOption } from '@/lib/search-filters'

const OPTIONS: { value: SortOption; labelKey: DictionaryKey; hintKey: DictionaryKey }[] = [
  { value: 'name', labelKey: 'search.sort.name', hintKey: 'search.sortHint.name' },
  { value: 'quantity', labelKey: 'search.sort.quantity', hintKey: 'search.sortHint.quantity' },
  { value: 'province', labelKey: 'search.sort.province', hintKey: 'search.sortHint.province' },
  { value: 'finds', labelKey: 'search.sort.finds', hintKey: 'search.sortHint.finds' },
  { value: 'coinTypes', labelKey: 'search.sort.coinTypes', hintKey: 'search.sortHint.coinTypes' },
  { value: 'states', labelKey: 'search.sort.states', hintKey: 'search.sortHint.states' },
]

/** Lives inside the surrounding filter `<form>` so changing it resubmits the
 * whole GET form (preserving every other filter) without any client routing. */
export function SortSelect({ value }: { value: SortOption }) {
  const { t } = useLanguage()

  return (
    <label className="flex items-center gap-2 text-xs text-gray-600">
      <ClickHint
        hint={
          <dl className="space-y-1.5">
            {OPTIONS.map((opt) => (
              <div key={opt.value}>
                <dt className="inline font-semibold text-gray-900">{t(opt.labelKey)}: </dt>
                <dd className="inline">{t(opt.hintKey)}</dd>
              </div>
            ))}
          </dl>
        }
        panelClassName="w-72"
        className="cursor-help font-semibold uppercase tracking-wide text-gray-500 underline decoration-dotted decoration-gray-400 underline-offset-2"
      >
        {t('search.sortBy')}
      </ClickHint>
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
