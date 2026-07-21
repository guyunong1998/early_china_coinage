'use client'

/**
 * A search input paired with an always-visible, scrollable checkbox list —
 * the multiselect counterpart to SearchableSelect (single-select, closes on
 * pick). Selection lives entirely in the parent (selectedKeys/onToggle) so
 * the caller can derive identity colors, map pins, etc. from selection
 * order — see colorByValue below and components/museum/AccessionNumberSearch.tsx
 * for the sibling pattern this mirrors.
 *
 * Used by: FindSpotsVisualization's "Filter by Mint" mode
 * (components/visualizations/MapVisualization.tsx).
 */

import { useMemo, useState } from 'react'

export type MultiSelectOption = {
  value: string
  label: string
  /** Extra text matched against the query but not shown as the label. */
  searchText?: string
  /** Rendered grayed-out with `mutedHint` alongside the label — for options
   * that are selectable but missing some secondary attribute (e.g. a mint
   * with no known map coordinates, so no pin will be dropped for it). */
  muted?: boolean
  mutedHint?: string
}

export function MultiSelectSearch({
  options,
  selectedKeys,
  colorByValue,
  onToggle,
  onClear,
  placeholder,
  noResultsLabel,
  selectedCountLabel,
  clearLabel,
}: {
  options: MultiSelectOption[]
  selectedKeys: Set<string>
  /** Identity color per selected value (by selection order), shown as a dot
   * on both the chip and the option's checkbox (via `accent-color`). */
  colorByValue: Map<string, string>
  onToggle: (value: string) => void
  onClear: () => void
  placeholder?: string
  noResultsLabel?: string
  selectedCountLabel: (count: number) => string
  clearLabel: string
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => `${o.label} ${o.searchText ?? ''}`.toLowerCase().includes(q))
  }, [options, query])

  const selectedOptions = useMemo(() => options.filter((o) => selectedKeys.has(o.value)), [options, selectedKeys])

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-brand/30 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />

      {selectedOptions.length > 0 && (
        <div className="space-y-1.5 rounded border border-brand/15 bg-brand-light/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {selectedCountLabel(selectedOptions.length)}
            </span>
            <button type="button" onClick={onClear} className="text-xs font-semibold text-brand hover:underline">
              {clearLabel}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggle(o.value)}
                className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: colorByValue.get(o.value) }}
                />
                {o.label}
                <span aria-hidden className="text-gray-400">
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto rounded border border-brand/30 bg-white">
        {filtered.length === 0 ? (
          <p className="px-2.5 py-1.5 text-sm text-gray-400">{noResultsLabel}</p>
        ) : (
          filtered.map((o) => {
            const isSelected = selectedKeys.has(o.value)
            const color = colorByValue.get(o.value)
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-brand-light ${
                  o.muted ? 'text-gray-400' : 'text-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(o.value)}
                  style={color ? { accentColor: color } : undefined}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer"
                />
                <span className="min-w-0 flex-1 truncate">
                  {o.label}
                  {o.muted && o.mutedHint && <span className="ml-1 text-xs italic">({o.mutedHint})</span>}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
