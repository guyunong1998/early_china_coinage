'use client'

import { useEffect, useRef, useState } from 'react'
import type { ComboOption } from './TaxonomyCombobox'
import type { TargetType } from '@/lib/admin/target-search'

/**
 * Search-as-you-type combobox for picking a site/context/find/coin_item to
 * attach a source_link to. Unlike TaxonomyCombobox, options aren't shipped
 * up front (sites/contexts/finds/coin_items are all far too large) — it
 * calls a dev-gated 'use server' search action per keystroke (debounced).
 *
 * Callers that change `targetType` at runtime (AddSourceLinkForm's "Cites"
 * select) MUST pass `key={targetType}` on this component so React remounts
 * it fresh — resetting selection/query/results by remounting, rather than
 * an effect calling setState on prop change.
 */
export function TargetSearchCombobox({
  name,
  targetType,
  initialValue,
  initialLabel,
  placeholder = 'Search by code or name…',
  searchAction,
}: {
  name: string
  targetType: TargetType
  initialValue?: string | null
  initialLabel?: string | null
  placeholder?: string
  searchAction: (targetType: TargetType, query: string) => Promise<ComboOption[]>
}) {
  const [selected, setSelected] = useState<ComboOption | null>(
    initialValue ? { value: initialValue, label: initialLabel ?? initialValue } : null
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ComboOption[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) return

    // This is React's own documented debounced-fetch-with-loading-state
    // pattern (react.dev/learn/synchronizing-with-effects); the stricter
    // React Compiler lint rule flags it regardless.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    let cancelled = false
    const handle = setTimeout(() => {
      searchAction(targetType, q)
        .then((opts) => {
          if (!cancelled) setResults(opts)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, targetType, searchAction])

  // Derived rather than reset via effect: an empty query has nothing to
  // show regardless of whatever `results` still holds from a prior search.
  const trimmedQuery = query.trim()
  const displayResults = trimmedQuery ? results : []

  function pick(option: ComboOption | null) {
    setSelected(option)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selected?.value ?? ''} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded border border-brand/30 bg-white px-2.5 py-1.5 text-left text-sm outline-none focus:border-brand"
      >
        {selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded border border-brand/30 bg-white shadow-lg">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="w-full border-b border-brand/20 px-2.5 py-1.5 text-sm outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="px-2.5 py-1.5 text-sm text-gray-400">Searching…</p>
            ) : displayResults.length === 0 ? (
              <p className="px-2.5 py-1.5 text-sm text-gray-400">{trimmedQuery ? 'No matches' : 'Type to search'}</p>
            ) : (
              displayResults.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-gray-800 hover:bg-brand-light"
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
