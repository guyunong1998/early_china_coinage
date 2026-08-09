'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN = 8
const GAP = 6

/**
 * A label that reveals a short explanation in a popover on click, not just
 * hover — native `title` tooltips don't work on touch devices and don't stay
 * open long enough for multi-sentence instructions (e.g. how Compare mode
 * works). Closes on an outside click or Escape.
 *
 * The popover renders through a portal into `document.body` and is
 * positioned in fixed coordinates computed from the trigger's own
 * bounding box, rather than `position: absolute` inside the trigger's own
 * stacking context — that way it's never clipped by an ancestor panel's
 * `overflow-hidden` (e.g. the last row of a card) and always paints above
 * everything else on the page.
 *
 * The trigger itself is a `<span role="button">`, not a real `<button>`, so
 * a hint can sit inside another real button (e.g. a tab label) without the
 * two nesting illegally — the browser would otherwise silently close the
 * outer button early and break its click handling.
 */
export function ClickHint({
  children,
  hint,
  className = '',
  panelClassName = 'w-64',
}: {
  children: ReactNode
  hint: ReactNode
  className?: string
  /** Width (and any other overrides) for the popover panel — defaults to the
   * plain-text hint's `w-64`, but richer content (e.g. an image preview)
   * needs its own size. */
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    function reposition() {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return
      const triggerRect = trigger.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()

      let left = triggerRect.left
      left = Math.min(left, window.innerWidth - panelRect.width - VIEWPORT_MARGIN)
      left = Math.max(left, VIEWPORT_MARGIN)

      let top = triggerRect.bottom + GAP
      if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
        top = triggerRect.top - panelRect.height - GAP
      }
      top = Math.max(top, VIEWPORT_MARGIN)

      setPos({ top, left })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function close() {
      setOpen(false)
      setPos(null)
    }
    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close()
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  // Reset the measured position at the moment we close, not in a later
  // effect, so the next open starts hidden-until-measured again instead of
  // flashing at last time's (possibly stale) coordinates.
  function toggle() {
    setOpen((o) => {
      if (o) setPos(null)
      return !o
    })
  }

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        aria-expanded={open}
        className={className}
      >
        {children}
      </span>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={`z-[1200] rounded border border-brand/20 bg-white p-2.5 text-xs font-normal normal-case leading-snug text-gray-700 shadow-lg ${panelClassName}`}
          >
            {hint}
          </div>,
          document.body
        )}
    </>
  )
}
