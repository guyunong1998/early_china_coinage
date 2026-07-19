'use client'

import { useState, type ReactNode } from 'react'
import { T } from '@/components/i18n/T'

/** Below 1440px the filter panel is collapsed by default, with the "Sort &
 * Filter" header itself acting as the toggle — clicking it unfurls the
 * content directly beneath, inside the same bordered panel, rather than
 * popping open a separate panel below a plain button. At 1440px+ the header
 * is always-open and inert — `pointer-events-none` there means the click
 * handler never fires at all (not just visually disguised), so the panel's
 * shape can't flicker from a stray toggle while the layout is already in
 * its permanently-open two-column desktop state. */
export function SearchFiltersToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`search-filter panel panel-collapsible ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="panel-header flex w-full items-center justify-between px-4 py-2 text-left text-sm font-bold uppercase tracking-wide min-[1440px]:cursor-default min-[1440px]:pointer-events-none"
      >
        <T k="filters.panelTitle" />
        <span aria-hidden className="min-[1440px]:hidden">
          {open ? '▲' : '▼'}
        </span>
      </button>
      <div className={`${open ? 'block' : 'hidden'} min-[1440px]:block`}>{children}</div>
    </div>
  )
}
