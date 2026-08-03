'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteSource, updateSource } from '@/lib/admin/sources-actions'
import { deleteSourceLink } from '@/lib/admin/source-links-actions'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { Source, SourceLink } from '@/lib/types'
import { displayValue } from '@/lib/format'
import { ConfirmDeleteButton } from '@/components/edit/ConfirmDeleteButton'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import { AddSourceLinkForm } from './AddSourceLinkForm'

function SourceFields({ source }: { source: Partial<Source> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldLabel>Source code</FieldLabel>
        <input name="source_code" defaultValue={source.source_code ?? ''} required className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author (zh)</FieldLabel>
        <input name="author_zh" defaultValue={source.author_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author (en)</FieldLabel>
        <input name="author_en" defaultValue={source.author_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Title (zh)</FieldLabel>
        <input name="title_zh" defaultValue={source.title_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Title (en)</FieldLabel>
        <input name="title_en" defaultValue={source.title_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Publication (zh)</FieldLabel>
        <input name="publication_zh" defaultValue={source.publication_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Publication (en)</FieldLabel>
        <input name="publication_en" defaultValue={source.publication_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Year</FieldLabel>
        <input name="year" type="number" defaultValue={source.year ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Page</FieldLabel>
        <input name="page" defaultValue={source.page ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Language</FieldLabel>
        <input name="language" defaultValue={source.language ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>URL</FieldLabel>
        <input name="url" defaultValue={source.url ?? ''} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Citation (zh)</FieldLabel>
        <textarea name="citation_zh" defaultValue={source.citation_zh ?? ''} rows={2} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Citation (en)</FieldLabel>
        <textarea name="citation_en" defaultValue={source.citation_en ?? ''} rows={2} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Note</FieldLabel>
        <textarea name="note_zh" defaultValue={source.note_zh ?? ''} rows={2} className={fieldInputClass} />
      </div>
    </div>
  )
}

function SourceDisplay({ source, index }: { source: Source; index: number }) {
  return (
    <>
      <p className="text-xs font-semibold text-brand">
        [{index + 1}] {source.source_code}
      </p>
      <p className="mt-1 leading-6 text-gray-800">
        {source.citation_zh ??
          `${displayValue(source.author_zh, '')}${source.author_zh ? '：' : ''}${displayValue(source.title_zh, '—')}`}
      </p>
      {source.title_en && <p className="mt-1 leading-6 italic text-gray-500">{source.title_en}</p>}
      <p className="mt-1 text-xs text-gray-500">
        {displayValue(source.publication_zh)}
        {source.year ? ` (${source.year})` : ''}
        {source.page ? `, p. ${source.page}` : ''}
      </p>
      {source.url && (
        <a href={source.url} className="mt-2 inline-block text-brand hover:underline" target="_blank" rel="noopener noreferrer">
          {source.url}
        </a>
      )}
    </>
  )
}

export function SourceCard({
  source,
  links,
  resolved,
  isDevMode,
  index,
  onSourceUpdated,
  onSourceDeleted,
  onLinkAdded,
  onLinkDeleted,
}: {
  source: Source
  links: SourceLink[]
  resolved: Map<string, ResolvedTarget>
  isDevMode: boolean
  index: number
  onSourceUpdated?: (source: Source) => void
  onSourceDeleted?: () => void
  onLinkAdded?: (link: SourceLink) => void
  onLinkDeleted?: (id: string) => void
}) {
  const [addingLink, setAddingLink] = useState(false)
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  async function handleDeleteLink(id: string) {
    setDeletingLinkId(id)
    setLinkError(null)
    const result = await deleteSourceLink(id)
    setDeletingLinkId(null)
    if (result.ok) onLinkDeleted?.(id)
    else setLinkError(result.formError ?? 'Failed to delete.')
  }

  return (
    <article className="panel-record-item p-4 text-sm">
      <EditableSection
        data={source}
        isDevMode={isDevMode}
        action={async (prev, formData) => {
          const result = await updateSource(prev, formData)
          if (result.ok) onSourceUpdated?.(result.data)
          return result
        }}
        deleteAction={
          links.length > 0
            ? undefined
            : async () => {
                const result = await deleteSource(source.id)
                if (result.ok) onSourceDeleted?.()
                return { ...result, data: source }
              }
        }
        onDeleted={onSourceDeleted}
        renderDisplay={(s) => <SourceDisplay source={s} index={index} />}
        renderForm={(s) => (
          <>
            <input type="hidden" name="id" value={s.id} />
            <SourceFields source={s} />
          </>
        )}
      />

      <div className="mt-3 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cited by ({links.length})</p>
        {links.length === 0 ? (
          <p className="mt-1 text-xs italic text-gray-400">No linked records yet.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {links.map((link) => {
              const target = resolved.get(`${link.target_type}:${link.target_code}`)
              return (
                <li key={link.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    <span className="text-gray-400">[{link.target_type}]</span>{' '}
                    {target?.href ? (
                      <Link href={target.href} className="text-brand hover:underline">
                        {target.label}
                      </Link>
                    ) : (
                      <span className="italic text-gray-400">{target?.label ?? link.target_code} (missing)</span>
                    )}
                    {link.page && <span className="text-gray-400"> · p. {link.page}</span>}
                  </span>
                  {isDevMode && (
                    <ConfirmDeleteButton
                      label="×"
                      pending={deletingLinkId === link.id}
                      onConfirm={() => handleDeleteLink(link.id)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {linkError && <p className="mt-1 text-xs text-red-600">{linkError}</p>}

        {isDevMode && (
          <div className="mt-2">
            {addingLink ? (
              <AddSourceLinkForm
                sourceCode={source.source_code}
                onCreated={(link) => {
                  onLinkAdded?.(link)
                  setAddingLink(false)
                }}
                onCancel={() => setAddingLink(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingLink(true)}
                className="text-xs font-semibold text-brand hover:underline"
              >
                + Add citation
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
