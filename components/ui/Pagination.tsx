import Link from 'next/link'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

type PaginationProps = {
  currentPage: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ currentPage, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
  )

  return (
    <nav className="mt-6 flex flex-wrap items-center gap-2 text-sm">
      <PageLink
        page={currentPage - 1}
        href={buildHref(currentPage - 1)}
        disabled={currentPage <= 1}
        labelKey="pagination.prev"
      />

      {pages.map((page, i) => {
        const prevPage = pages[i - 1]
        const showEllipsis = prevPage !== undefined && page - prevPage > 1
        return (
          <span key={page} className="flex items-center gap-2">
            {showEllipsis && <span className="text-gray-400">…</span>}
            <Link
              href={buildHref(page)}
              className={`rounded border px-3 py-1.5 transition ${
                page === currentPage
                  ? 'border-brand bg-brand text-white'
                  : 'border-brand/30 bg-white text-brand hover:bg-brand-light'
              }`}
            >
              {page}
            </Link>
          </span>
        )
      })}

      <PageLink
        page={currentPage + 1}
        href={buildHref(currentPage + 1)}
        disabled={currentPage >= totalPages}
        labelKey="pagination.next"
      />
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  labelKey,
}: {
  page: number
  href: string
  disabled: boolean
  labelKey: DictionaryKey
}) {
  if (disabled) {
    return (
      <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-300">
        <T k={labelKey} />
      </span>
    )
  }
  return (
    <Link href={href} className="rounded border border-brand/30 bg-white px-3 py-1.5 text-brand hover:bg-brand-light">
      <T k={labelKey} />
    </Link>
  )
}
