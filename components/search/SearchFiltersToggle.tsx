'use client'

import { useState, type ReactNode } from 'react'
import { T } from '@/components/i18n/T'

/** Below 1440px the filter panel is collapsed by default with a toggle button;
 * at 1440px+ it's always shown (the toggle button hides itself there). */
export function SearchFiltersToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between border border-brand/30 bg-white px-3 py-2 text-sm font-semibold text-brand min-[1440px]:hidden"
      >
        <T k="filters.toggle" />
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      <div className={`${open ? 'block' : 'hidden'} min-[1440px]:block`}>{children}</div>
    </div>
  )
}
