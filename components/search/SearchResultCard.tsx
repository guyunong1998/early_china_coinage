'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

/** Card for one search result: a tab-style header sitting above the bordered
 * panel, with the whole panel clickable (except nested links, which stop
 * propagation so they don't double-navigate). */
export function SearchResultCard({
  href,
  siteName,
  siteNameEn,
  viewRecordLabel,
  children,
}: {
  href: string
  siteName: ReactNode
  siteNameEn?: ReactNode
  viewRecordLabel: ReactNode
  children: ReactNode
}) {
  const router = useRouter()

  function goToRecord(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('a, button')) return
    router.push(href)
  }

  function goToRecordOnEnter(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(href)
    }
  }

  function stopPropagation(e: MouseEvent) {
    e.stopPropagation()
  }

  return (
    <div className="group">
      <div className="panel-header inline-block px-4 py-2 text-sm font-bold uppercase tracking-wide">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <Link href={href} className="hover:underline" onClick={stopPropagation}>
            {siteName}
          </Link>
          {siteNameEn}
        </span>
      </div>

      <div
        role="link"
        tabIndex={0}
        onClick={goToRecord}
        onKeyDown={goToRecordOnEnter}
        className="panel-search-item cursor-pointer overflow-hidden"
      >
        <div className="p-4">
          {children}
          <Link
            href={href}
            onClick={stopPropagation}
            className="mt-2 inline-block rounded text-sm text-brand outline-offset-4 hover:underline group-hover:outline-2 group-hover:outline-dashed group-hover:outline-brand"
          >
            {viewRecordLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
