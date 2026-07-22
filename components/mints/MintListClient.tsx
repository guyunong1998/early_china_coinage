'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { MintTypeLabel } from '@/lib/mint-directory'
import type { MintTown } from '@/lib/mint-towns'
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
  mints: MintTown[],
  sort: SortOption,
  statsByMint: Record<string, MintStats>,
  issuesByMint: Record<string, number>,
  completenessByMint: Record<string, number>
): MintTown[] {
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

/** Searches the list actually being displayed (`all`), not the static
 * MINT_TOWNS dossier list — `all` may include DB-only mints with no
 * dossier entry, which would otherwise be unsearchable. Matches against
 * whichever coin-type labels are actually shown on the card: the live
 * bilingual ones from `typesByMint` where available, else the static
 * dossier's English-only `coin_types`. */
function filterMints(mints: MintTown[], typesByMint: Record<string, MintTypeLabel[]>, query: string): MintTown[] {
  const q = query.trim().toLowerCase()
  if (!q) return mints
  return mints.filter((m) => {
    const liveTypes = typesByMint[m.name_zh]
    const typeMatch =
      liveTypes && liveTypes.length > 0
        ? liveTypes.some((t) => t.zh.includes(q) || (t.en ?? '').toLowerCase().includes(q))
        : m.coin_types.some((t) => t.toLowerCase().includes(q))
    return (
      m.name_en.toLowerCase().includes(q) ||
      m.name_zh.includes(q) ||
      m.state_en.toLowerCase().includes(q) ||
      m.state_zh.includes(q) ||
      m.modern_location_en.toLowerCase().includes(q) ||
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
  all: MintTown[]
  statsByMint?: Record<string, MintStats>
  /** Bilingual coin-type labels per mint, computed live from coin_issues
   * (lib/mint-directory.ts's buildMintTypeLabels) — preferred over the
   * static, English-only `MintTown.coin_types` wherever available. */
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
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${stateTagColor(mint.state_en)}`}
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
                  {liveTypes && liveTypes.length > 0
                    ? liveTypes.map((type) => (
                        <span
                          key={type.zh}
                          className="rounded border border-brand/20 bg-brand-light px-2 py-0.5 text-xs text-brand"
                        >
                          {lang === 'zh' || !type.en ? type.zh : type.en}
                        </span>
                      ))
                    : // mint.coin_types is a hand-transcribed, English-only
                      // local dossier field (lib/mint-towns.ts) with no
                      // Chinese counterpart — styled/tagged distinctly from
                      // the bilingual, database-sourced tags above so it
                      // never reads as translated when the page is in
                      // Chinese (see lib/mint-directory.ts's buildMintTypeLabels).
                      mint.coin_types.map((type) => (
                        <span
                          key={type}
                          title={t('mintList.localDataTag')}
                          className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500"
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
            )
          })}
        </div>
      )}
    </div>
  )
}
