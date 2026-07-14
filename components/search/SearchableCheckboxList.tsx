'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { FacetOption } from '@/lib/search-filters'

export function SearchableCheckboxList({
  name,
  options,
  selected,
}: {
  name: string
  options: FacetOption[]
  selected: string[]
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  return (
    <div>
      <input
        type="search"
        placeholder={t('filters.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded border border-brand/30 px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
      <div className="max-h-52 space-y-1 overflow-y-auto">
        {options.map((opt) => {
          // Hidden (not removed) so an already-checked box never loses its
          // uncontrolled DOM state when the search text changes.
          const hidden =
            q.length > 0 &&
            !opt.value.toLowerCase().includes(q) &&
            !(opt.en && opt.en.toLowerCase().includes(q))
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 px-1 py-1 text-sm text-gray-700 hover:bg-brand-light ${
                hidden ? 'hidden' : ''
              }`}
            >
              <input
                type="checkbox"
                name={name}
                value={opt.value}
                defaultChecked={selected.includes(opt.value)}
                className="accent-brand"
              />
              <span className="flex-1">
                {opt.value}
                {opt.en && opt.en !== opt.value && (
                  <span className="ml-1.5 text-xs italic text-gray-400">({opt.en})</span>
                )}
              </span>
              <span className="text-xs text-gray-400">({opt.count})</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
