'use client'

/**
 * Nav dropdown for mobile and tablet (hidden at the `lg` breakpoint, where
 * SiteHeader's own horizontal nav takes over). A hamburger button toggles a
 * dropdown panel with the same links as the desktop nav.
 *
 * Used by: components/layout/SiteHeader.tsx.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

const NAV_LINKS: { href: string; key: DictionaryKey; hintKey?: DictionaryKey }[] = [
  { href: '/mints', key: 'nav.mints' },
  { href: '/coin-types', key: 'nav.coinTypes' },
  { href: '/visualizations', key: 'nav.map' },
  { href: '/museum-collections', key: 'nav.spadeHeatmap', hintKey: 'nav.spadeHeatmapHint' },
  { href: '/search', key: 'nav.search' },
  { href: '/about', key: 'nav.about' },
]

export function MobileNav() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Toggle navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded border border-brand/30 text-brand"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          {open ? (
            <path
              d="M4 4L14 14M14 4L4 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M2.5 5H15.5M2.5 9H15.5M2.5 13H15.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[1100] mt-2 w-48 rounded border border-brand/20 bg-white py-1 shadow-lg">
          <nav className="flex flex-col divide-y divide-brand/10 text-sm font-medium text-gray-700">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                title={link.hintKey ? t(link.hintKey) : undefined}
                className="px-4 py-2.5 hover:bg-brand-light hover:text-brand"
              >
                <T k={link.key} />
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
