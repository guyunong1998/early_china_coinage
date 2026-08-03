'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Delete trigger that requires the user to type "delete" before the confirm
 * button un-disables — used for every direct record deletion (contexts,
 * finds, sources, source_links). Clicking the trigger opens a small inline
 * popover (closes on outside click/Escape) rather than a double-click arm,
 * since a stray second click is too easy to trigger by accident.
 */
export function ConfirmDeleteButton({
  onConfirm,
  label = 'Delete',
  pending = false,
  className = '',
}: {
  onConfirm: () => void
  label?: string
  pending?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setText('')
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setText('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const confirmed = text.trim().toLowerCase() === 'delete'

  function handleConfirm() {
    if (!confirmed || pending) return
    onConfirm()
    setOpen(false)
    setText('')
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? 'Deleting…' : label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded border border-red-200 bg-white p-2 shadow-lg">
          <p className="mb-1.5 text-xs text-gray-600">
            Type <span className="font-mono font-semibold text-gray-800">delete</span> to confirm.
          </p>
          <input
            type="text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirm()
              }
            }}
            placeholder="delete"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-red-400"
          />
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              disabled={!confirmed || pending}
              onClick={handleConfirm}
              className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setText('')
              }}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
