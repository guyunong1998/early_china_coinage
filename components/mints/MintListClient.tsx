'use client'

import Link from 'next/link'
import { useState } from 'react'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { searchMints } from '@/lib/mint-towns'
import type { MintTown } from '@/lib/mint-towns'

const STATE_COLORS: Record<string, string> = {
  Wei: 'bg-amber-100 text-amber-800',
  Zhao: 'bg-blue-100 text-blue-800',
  Yan: 'bg-green-100 text-green-800',
  Zhongshan: 'bg-purple-100 text-purple-800',
  Qi: 'bg-rose-100 text-rose-800',
  Qin: 'bg-orange-100 text-orange-800',
  Han: 'bg-sky-100 text-sky-800',
}

function stateColor(state_en: string) {
  return STATE_COLORS[state_en] ?? 'bg-gray-100 text-gray-700'
}

export function MintListClient({ all }: { all: MintTown[] }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const results = query ? searchMints(query) : all

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6 flex gap-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mintList.searchPlaceholder')}
          className="w-full rounded-l border border-brand/30 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand"
        />
        <span className="flex items-center rounded-r border border-l-0 border-brand/30 bg-white px-3 text-gray-400 text-sm">
          {results.length}
        </span>
      </div>

      {/* Grid */}
      {results.length === 0 ? (
        <p className="text-sm text-gray-500">{t('mintList.noResults', { query })}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((mint) => (
            <Link
              key={mint.mint_code}
              href={`/mints/${mint.mint_code}`}
              className="panel group flex flex-col p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-gray-900 group-hover:text-brand">
                    {mint.name_zh}
                  </h2>
                  <p className="text-sm text-gray-500">{mint.name_en}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${stateColor(mint.state_en)}`}
                >
                  {mint.state_zh}
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-500">{mint.modern_location_en}</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {mint.coin_types.map((type) => (
                  <span
                    key={type}
                    className="rounded border border-brand/20 bg-brand-light px-2 py-0.5 text-xs text-brand"
                  >
                    {type}
                  </span>
                ))}
                {mint.description_en.length <= 60 && (
                  <span className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400">
                    <T k="mintList.inPreparation" />
                  </span>
                )}
              </div>

              <span className="mt-4 text-xs text-brand opacity-0 transition group-hover:opacity-100">
                <T k="mintList.viewDetails" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
