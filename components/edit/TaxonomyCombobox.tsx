'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'

export type ComboOption = { value: string; label: string; searchText?: string }

/**
 * Single-select searchable combobox (closes on pick), extending
 * components/ui/MultiSelectSearch.tsx's visual language, with an optional
 * pinned "+ Add new" row that opens a Modal containing a quick-create form.
 * Posts its value as a hidden <input name> so it works inside any enclosing
 * <form> without extra plumbing. Used for coin_issues' mint/state/
 * inscription/coin_type_hierarchy assignment (addNewLabel set on all 4) and
 * for a find's coin_issues_id assignment (addNewLabel omitted).
 */
export function TaxonomyCombobox({
  name,
  options,
  initialValue,
  initialLabel,
  placeholder = 'Select…',
  noResultsLabel = 'No matches',
  addNewLabel,
  renderAddForm,
}: {
  name: string
  options: ComboOption[]
  initialValue?: string | null
  initialLabel?: string | null
  placeholder?: string
  noResultsLabel?: string
  addNewLabel?: string
  renderAddForm?: (opts: { onCreated: (opt: ComboOption) => void; onCancel: () => void }) => React.ReactNode
}) {
  const [localOptions, setLocalOptions] = useState(options)
  const [selected, setSelected] = useState<ComboOption | null>(
    initialValue ? { value: initialValue, label: initialLabel ?? initialValue } : null
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return localOptions
    return localOptions.filter((o) => `${o.label} ${o.searchText ?? ''}`.toLowerCase().includes(q))
  }, [localOptions, query])

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
            placeholder="Search…"
            className="w-full border-b border-brand/20 px-2.5 py-1.5 text-sm outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            {selected && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="flex w-full items-center px-2.5 py-1.5 text-left text-sm italic text-gray-400 hover:bg-gray-50"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-2.5 py-1.5 text-sm text-gray-400">{noResultsLabel}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o)}
                  className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-sm text-gray-800 hover:bg-brand-light"
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
          {addNewLabel && renderAddForm && (
            <button
              type="button"
              onClick={() => {
                setAddOpen(true)
                setOpen(false)
              }}
              className="sticky bottom-0 w-full border-t border-brand/20 bg-brand-light/50 px-2.5 py-1.5 text-left text-sm font-semibold text-brand hover:bg-brand-light"
            >
              + {addNewLabel}
            </button>
          )}
        </div>
      )}

      {addOpen && renderAddForm && (
        <Modal title={addNewLabel ?? 'Add new'} onClose={() => setAddOpen(false)}>
          {renderAddForm({
            onCreated: (opt) => {
              setLocalOptions((prev) => [opt, ...prev])
              pick(opt)
              setAddOpen(false)
            },
            onCancel: () => setAddOpen(false),
          })}
        </Modal>
      )}
    </div>
  )
}
