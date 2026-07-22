'use client'

import { useMemo, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { CoinTypeCard } from '@/components/coin-types/CoinTypeCard'
import { isMouldNode, type CoinTypeCounts, type CoinTypeNode } from '@/lib/coin-type-catalog'
import type { CoinTypeImagePaths } from '@/lib/coin-images'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

type SortOption = 'hierarchy' | 'level' | 'finds' | 'coins' | 'issues'

const SORT_OPTIONS: { value: SortOption; labelKey: DictionaryKey }[] = [
  { value: 'hierarchy', labelKey: 'coinTypeList.sort.hierarchy' },
  { value: 'level', labelKey: 'coinTypeList.sort.level' },
  { value: 'finds', labelKey: 'coinTypeList.sort.finds' },
  { value: 'coins', labelKey: 'coinTypeList.sort.coins' },
  { value: 'issues', labelKey: 'coinTypeList.sort.issues' },
]

function levelNumber(level: CoinTypeNode['level']): number {
  return Number(level.replace('level', ''))
}

function sortNodes(nodes: CoinTypeNode[], sort: SortOption, countsBySlug: Record<string, CoinTypeCounts>) {
  if (sort === 'hierarchy') return nodes
  const sorted = [...nodes]
  const counts = (slug: string) => countsBySlug[slug] ?? { coinCount: 0, siteCount: 0, findCount: 0, issueCount: 0 }
  switch (sort) {
    case 'level':
      sorted.sort(
        (a, b) => levelNumber(a.level) - levelNumber(b.level) || a.label_zh.localeCompare(b.label_zh, 'zh-CN')
      )
      break
    case 'finds':
      sorted.sort((a, b) => counts(b.slug).findCount - counts(a.slug).findCount)
      break
    case 'coins':
      sorted.sort((a, b) => counts(b.slug).coinCount - counts(a.slug).coinCount)
      break
    case 'issues':
      sorted.sort((a, b) => counts(b.slug).issueCount - counts(a.slug).issueCount)
      break
  }
  return sorted
}

/** Searchable, sortable grid of coin-type cards — mirrors MintListClient's
 * search bar + grid so the two list pages read as one system. */
export function CoinTypeListClient({
  nodes,
  countsBySlug,
  imagesBySlug,
}: {
  nodes: CoinTypeNode[]
  countsBySlug: Record<string, CoinTypeCounts>
  imagesBySlug: Record<string, CoinTypeImagePaths>
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('hierarchy')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = !q
      ? nodes
      : nodes.filter(
          (n) =>
            n.label_zh.includes(query.trim()) ||
            n.label_en.toLowerCase().includes(q) ||
            n.states.some(
              (s) => s.state_zh.includes(query.trim()) || (s.state_en ?? '').toLowerCase().includes(q)
            ) ||
            n.parents.some((p) => p.label_zh.includes(query.trim()) || p.label_en.toLowerCase().includes(q))
        )
    return sortNodes(filtered, sort, countsBySlug)
  }, [nodes, query, sort, countsBySlug])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 gap-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('coinTypeList.searchPlaceholder')}
            className="w-full rounded-l border border-brand/30 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand"
          />
          <span className="flex items-center rounded-r border border-l-0 border-brand/30 bg-white px-3 text-gray-400 text-sm">
            {results.length}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-semibold uppercase tracking-wide text-gray-500">{t('coinTypeList.sortBy')}</span>
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

      {results.length === 0 ? (
        <p className="text-sm text-gray-500">{t('coinTypeList.noResults', { query })}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((node) => (
            <CoinTypeCard
              key={node.slug}
              node={node}
              counts={countsBySlug[node.slug]}
              images={imagesBySlug[node.slug]}
              isMould={isMouldNode(node)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
