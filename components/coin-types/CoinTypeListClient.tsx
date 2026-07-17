'use client'

import { useMemo, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { CoinTypeCard } from '@/components/coin-types/CoinTypeCard'
import type { CoinTypeCounts, CoinTypeNode } from '@/lib/coin-type-catalog'

/** Searchable grid of coin-type cards — mirrors MintListClient's search bar
 * + grid so the two list pages read as one system. */
export function CoinTypeListClient({
  nodes,
  countsBySlug,
}: {
  nodes: CoinTypeNode[]
  countsBySlug: Record<string, CoinTypeCounts>
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter(
      (n) =>
        n.label_zh.includes(query.trim()) ||
        n.label_en.toLowerCase().includes(q) ||
        n.states.some((s) => s.state_zh.includes(query.trim()) || (s.state_en ?? '').toLowerCase().includes(q)) ||
        n.parents.some((p) => p.label_zh.includes(query.trim()) || p.label_en.toLowerCase().includes(q))
    )
  }, [nodes, query])

  return (
    <div>
      <div className="mb-6 flex gap-0">
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

      {results.length === 0 ? (
        <p className="text-sm text-gray-500">{t('coinTypeList.noResults', { query })}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((node) => (
            <CoinTypeCard key={node.slug} node={node} counts={countsBySlug[node.slug]} />
          ))}
        </div>
      )}
    </div>
  )
}
