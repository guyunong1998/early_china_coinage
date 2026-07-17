'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchableSelectOption = {
  value: string
  label: string
  /** Extra text matched against the query but not shown as the label
   * (e.g. an English name or state, alongside a Chinese label). */
  searchText?: string
}

/** A single text input that doubles as a filterable dropdown — combines what
 * used to be a separate search box + <select> into one control. Typing
 * filters the option list shown below; clicking an option selects it. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  noResultsLabel,
}: {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  noResultsLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.searchText ?? ''}`.toLowerCase().includes(q)
    )
  }, [options, query])

  const displayValue = open ? query : selected?.label ?? ''

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery(selected?.label ?? '')
        }}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border border-brand/30 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border border-brand/30 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-1.5 text-sm text-gray-400">{noResultsLabel}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value)
                  setQuery(o.label)
                  setOpen(false)
                }}
                className={`block w-full px-2.5 py-1.5 text-left text-sm hover:bg-brand-light ${
                  o.value === value ? 'bg-brand-light font-semibold text-brand' : 'text-gray-800'
                }`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
