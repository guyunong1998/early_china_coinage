'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Bare fixed-overlay modal — no dependency. Used only by TaxonomyCombobox's
 * "+ Add new" popup (the one explicitly-requested exception to this
 * feature's otherwise inline, no-popups editing pattern). */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="panel max-h-[85vh] w-full max-w-md overflow-y-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header flex items-center justify-between px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <span>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700">
            ×
          </button>
        </div>
        <div className="panel-body p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
