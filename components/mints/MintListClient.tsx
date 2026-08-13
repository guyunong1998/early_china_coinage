'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { MintDirectoryEntry, MintTypeLabel } from '@/lib/mint-directory'
import { stateTagColor } from '@/lib/state-colors'

type MintStats = { coinCount: number; siteCount: number }

type SortOption = 'name' | 'finds' | 'coins' | 'issues' | 'completeness'

const SORT_OPTIONS: { value: SortOption; labelKey: DictionaryKey }[] = [
  { value: 'name', labelKey: 'mintList.sort.name' },
  { value: 'finds', labelKey: 'mintList.sort.finds' },
  { value: 'coins', labelKey: 'mintList.sort.coins' },
  { value: 'issues', labelKey: 'mintList.sort.issues' },
  { value: 'completeness', labelKey: 'mintList.sort.completeness' },
]

function sortMints(
  mints: MintDirectoryEntry[],
  sort: SortOption,
  statsByMint: Record<string, MintStats>,
  issuesByMint: Record<string, number>,
  completenessByMint: Record<string, number>
): MintDirectoryEntry[] {
  if (sort === 'name') return mints
  const sorted = [...mints]
  switch (sort) {
    case 'finds':
      sorted.sort((a, b) => (statsByMint[b.name_zh]?.siteCount ?? 0) - (statsByMint[a.name_zh]?.siteCount ?? 0))
      break
    case 'coins':
      sorted.sort((a, b) => (statsByMint[b.name_zh]?.coinCount ?? 0) - (statsByMint[a.name_zh]?.coinCount ?? 0))
      break
    case 'issues':
      sorted.sort((a, b) => (issuesByMint[b.name_zh] ?? 0) - (issuesByMint[a.name_zh] ?? 0))
      break
    case 'completeness':
      sorted.sort((a, b) => (completenessByMint[b.name_zh] ?? 0) - (completenessByMint[a.name_zh] ?? 0))
      break
  }
  return sorted
}

/** Searches the list actually being displayed (`all`), which now already
 * covers every mint in the database. Matches against the live bilingual
 * coin-type labels from `typesByMint` (computed from coin_issues; see
 * lib/mint-directory.ts's buildMintTypeLabels), and against
 * alternative_names (historical spellings a researcher might search for). */
function filterMints(mints: MintDirectoryEntry[], typesByMint: Record<string, MintTypeLabel[]>, query: string): MintDirectoryEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return mints
  return mints.filter((m) => {
    const liveTypes = typesByMint[m.name_zh]
    const typeMatch = liveTypes?.some((t) => t.zh.includes(q) || (t.en ?? '').toLowerCase().includes(q)) ?? false
    return (
      m.name_en.toLowerCase().includes(q) ||
      m.name_zh.includes(q) ||
      m.state_en.toLowerCase().includes(q) ||
      m.state_zh.includes(q) ||
      m.modern_location_en.toLowerCase().includes(q) ||
      m.alternative_names.some((alt) => alt.includes(q)) ||
      typeMatch
    )
  })
}

export function MintListClient({
  all,
  statsByMint = {},
  typesByMint = {},
  issuesByMint = {},
  completenessByMint = {},
}: {
  all: MintDirectoryEntry[]
  statsByMint?: Record<string, MintStats>
  /** Bilingual coin-type labels per mint, computed live from coin_issues
   * (lib/mint-directory.ts's buildMintTypeLabels). */
  typesByMint?: Record<string, MintTypeLabel[]>
  /** Distinct catalogued coin_issues per mint (lib/mint-directory.ts's
   * consumer in app/mints/page.tsx) — the "Number of issues" sort option. */
  issuesByMint?: Record<string, number>
  /** lib/mint-directory.ts's mintCompleteness score per mint — the
   * "Completion of information" sort option. */
  completenessByMint?: Record<string, number>
}) {
  const { t, lang } = useLanguage()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('name')

  const results = useMemo(() => {
    const filtered = query ? filterMints(all, typesByMint, query) : all
    return sortMints(filtered, sort, statsByMint, issuesByMint, completenessByMint)
  }, [all, query, sort, typesByMint, statsByMint, issuesByMint, completenessByMint])

  return (
    <div>
      {/* Search bar + sort */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 gap-0">
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
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-semibold uppercase tracking-wide text-gray-500">{t('mintList.sortBy')}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Grid */}
      {results.length === 0 ? (
        <p className="text-sm text-gray-500">{t('mintList.noResults', { query })}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((mint) => {
            const stats = statsByMint[mint.name_zh]
            const liveTypes = typesByMint[mint.name_zh]
            return (
              <Link
                key={mint.mint_code}
                href={`/mints/${mint.mint_code}`}
                className="panel group flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-lg font-semibold text-gray-900 group-hover:text-brand">
                    {mint.name_zh} <span className="text-sm font-normal text-gray-500">({mint.name_en})</span>
                  </h2>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${stateTagColor(mint.state_zh)}`}
                  >
                    {lang === 'zh' ? mint.state_zh : mint.state_en}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  {mint.modern_location_zh ? `${mint.modern_location_zh} (${mint.modern_location_en})` : mint.modern_location_en}
                </p>

                {stats && stats.coinCount > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t('mintList.coinsInSites', { coins: stats.coinCount, sites: stats.siteCount })}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1">
                  {liveTypes?.map((type) => (
                    <span
                      key={type.zh}
                      className="rounded border border-brand/20 bg-brand-light px-2 py-0.5 text-xs text-brand"
                    >
                      {lang === 'zh' || !type.en ? type.zh : type.en}
                    </span>
                  ))}
                </div>

                <span className="mt-4 text-xs text-brand opacity-0 transition group-hover:opacity-100">
                  <T k="mintList.viewDetails" />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
