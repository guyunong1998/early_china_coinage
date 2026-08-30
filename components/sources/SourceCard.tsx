'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteSource, updateSource } from '@/lib/admin/sources-actions'
import { deleteSourceLink } from '@/lib/admin/source-links-actions'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { Source, SourceLink } from '@/lib/types'
import { SOURCE_TYPES } from '@/lib/types'
import { formatSourceCitation, sourceDisplayType } from '@/lib/format-citation'
import { ConfirmDeleteButton } from '@/components/edit/ConfirmDeleteButton'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import { AddSourceLinkForm } from './AddSourceLinkForm'

export function SourceFields({ source }: { source: Partial<Source> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldLabel>Source code</FieldLabel>
        <input name="source_code" defaultValue={source.source_code ?? ''} required className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Type</FieldLabel>
        <select name="type" defaultValue={source.type ?? ''} className={fieldInputClass}>
          <option value="">—</option>
          {SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel>Year</FieldLabel>
        <input name="year" type="number" defaultValue={source.year ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author 1 (zh)</FieldLabel>
        <input name="author1_zh" defaultValue={source.author1_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author 1 (en)</FieldLabel>
        <input name="author1_en" defaultValue={source.author1_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author 2 (zh)</FieldLabel>
        <input name="author2_zh" defaultValue={source.author2_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author 2 (en)</FieldLabel>
        <input name="author2_en" defaultValue={source.author2_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author 3 (zh)</FieldLabel>
        <input name="author3_zh" defaultValue={source.author3_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Author 3 (en)</FieldLabel>
        <input name="author3_en" defaultValue={source.author3_en ?? ''} className={fieldInputClass} />
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
        <FieldLabel>Book title (zh)</FieldLabel>
        <input name="book_zh" defaultValue={source.book_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Book title (en)</FieldLabel>
        <input name="book_en" defaultValue={source.book_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Editor (zh)</FieldLabel>
        <input name="editor_zh" defaultValue={source.editor_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Editor (en)</FieldLabel>
        <input name="editor_en" defaultValue={source.editor_en ?? ''} className={fieldInputClass} />
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
        <FieldLabel>Place (zh)</FieldLabel>
        <input name="place_zh" defaultValue={source.place_zh ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Place (en)</FieldLabel>
        <input name="place_en" defaultValue={source.place_en ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Volume / issue</FieldLabel>
        <input name="volume" defaultValue={source.volume ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Date (MM-DD)</FieldLabel>
        <input name="date" defaultValue={source.date ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Page</FieldLabel>
        <input name="page" defaultValue={source.page ?? ''} className={fieldInputClass} />
      </div>
      <div>
        <FieldLabel>Language</FieldLabel>
        <input name="language" defaultValue={source.language ?? ''} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
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
        <FieldLabel>Note (zh)</FieldLabel>
        <textarea name="note_zh" defaultValue={source.note_zh ?? ''} rows={2} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Note (en)</FieldLabel>
        <textarea name="note_en" defaultValue={source.note_en ?? ''} rows={2} className={fieldInputClass} />
      </div>
    </div>
  )
}

function SourceDisplay({ source, index }: { source: Source; index: number }) {
  const typeLabel = sourceDisplayType(source)
  return (
    <>
      <p className="text-xs font-semibold text-brand">
        [{index + 1}] {source.source_code}
        {typeLabel ? <span className="ml-2 font-normal text-gray-500">{typeLabel}</span> : null}
      </p>
      <p className="mt-1 leading-6 text-gray-800">{formatSourceCitation(source, null, { includePage: false })}</p>
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
