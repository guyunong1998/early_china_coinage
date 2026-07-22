'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A label that reveals a short explanation in a popover on click, not just
 * hover — native `title` tooltips don't work on touch devices and don't stay
 * open long enough for multi-sentence instructions (e.g. how Compare mode
 * works). Closes on an outside click or Escape.
 */
export function ClickHint({
  children,
  hint,
  className = '',
}: {
  children: ReactNode
  hint: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={className}>
        {children}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[1200] mt-1.5 w-64 rounded border border-brand/20 bg-white p-2.5 text-xs font-normal normal-case leading-snug text-gray-700 shadow-lg">
          {hint}
        </div>
      )}
    </span>
  )
}
