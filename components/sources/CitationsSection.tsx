'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { deleteSourceLink } from '@/lib/admin/source-links-actions'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { Source, SourceLink } from '@/lib/types'
import { displayValue } from '@/lib/format'
import { AddSourceLinkForm } from '@/components/sources/AddSourceLinkForm'
import { ConfirmDeleteButton } from '@/components/edit/ConfirmDeleteButton'

/**
 * Combined "Sources & Citations" box, shared by the site and mint detail
 * pages: structured, per-record citations from source_links on top (add/
 * delete, dev-only), and whatever legacy freetext citations still exist for
 * this record at the bottom. The legacy content is caller-supplied since its
 * shape differs per record type — sites/contexts/finds have a single
 * delimited `source_code` string, mints have a `sources_unlinked` array
 * plus a separate `citation` string.
 */
export function CitationsSection({
  targetType,
  targetCode,
  targetLabel,
  initialLinks,
  sourcesByCode,
  resolvedTargets,
  isDevMode,
  legacy,
}: {
  targetType: SourceLink['target_type']
  targetCode: string
  targetLabel: string
  initialLinks: SourceLink[]
  sourcesByCode: Map<string, Source>
  resolvedTargets: Map<string, ResolvedTarget>
  isDevMode: boolean
  /** The record's own legacy/unlinked citation content, rendered below the
   * structured list — omitted entirely once a record type has no legacy
   * citation source left (e.g. sites/contexts/finds, whose freetext
   * source_code column was retired once every value had a proper
   * source_links row). */
  legacy?: ReactNode
}) {
  const [links, setLinks] = useState(initialLinks)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteSourceLink(id)
    setDeletingId(null)
    if (result.ok) setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <div className="space-y-4">
      {isDevMode && (
        <div>
          {adding ? (
            <AddSourceLinkForm
              defaultTargetType={targetType}
              defaultTargetCode={targetCode}
              defaultTargetLabel={targetLabel}
              onCreated={(link) => {
                setLinks((prev) => [...prev, link])
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-light"
            >
              + Add citation
            </button>
          )}
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm italic text-gray-500">No structured citations linked yet.</p>
      ) : (
        links.map((link) => {
          const source = sourcesByCode.get(link.source_code)
          const target = resolvedTargets.get(`${link.target_type}:${link.target_code}`)
          return (
            <article key={link.id} className="panel-record-item p-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-semibold text-brand">{link.source_code}</p>
                {isDevMode && (
                  <ConfirmDeleteButton pending={deletingId === link.id} onConfirm={() => handleDelete(link.id)} />
                )}
              </div>
              {source ? (
                <>
                  <p className="mt-1 leading-6 text-gray-800">
                    {source.citation_zh ??
                      `${displayValue(source.author_zh, '')}${source.author_zh ? '：' : ''}${displayValue(source.title_zh, '—')}`}
                  </p>
                  {source.title_en && <p className="mt-1 leading-6 italic text-gray-500">{source.title_en}</p>}
                </>
              ) : (
                <p className="mt-1 italic text-gray-400">Source not found.</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Cites{' '}
                <span className="text-gray-400">[{link.target_type}]</span>{' '}
                {target?.href ? (
                  <Link href={target.href} className="text-brand hover:underline">
                    {target.label}
                  </Link>
                ) : (
                  <span className="italic text-gray-400">{target?.label ?? link.target_code}</span>
                )}
                {link.page && ` · p. ${link.page}`}
              </p>
              {(link.note_zh || link.note_en) && (
                <p className="mt-1 text-xs text-gray-500">{link.note_zh || link.note_en}</p>
              )}
            </article>
          )
        })
      )}

      {legacy != null && (
        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Legacy / unlinked references
          </p>
          {legacy}
        </div>
      )}
    </div>
  )
}
