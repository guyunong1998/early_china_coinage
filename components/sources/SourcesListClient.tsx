'use client'

import { useMemo, useState } from 'react'
import { createSource } from '@/lib/admin/sources-actions'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { ActionState } from '@/lib/admin/types'
import type { Source, SourceLink } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { SourceCard, SourceFields } from './SourceCard'

const BLANK_SOURCE: Source = {
  id: '',
  source_code: '',
  type: null,
  author1_zh: null,
  author1_en: null,
  author2_zh: null,
  author2_en: null,
  author3_zh: null,
  author3_en: null,
  editor_zh: null,
  editor_en: null,
  title_zh: null,
  title_en: null,
  book_zh: null,
  book_en: null,
  language: null,
  year: null,
  publication_zh: null,
  publication_en: null,
  place_zh: null,
  place_en: null,
  volume: null,
  date: null,
  page: null,
  citation_zh: null,
  citation_en: null,
  url: null,
  note_zh: null,
  note_en: null,
}

const PAGE_SIZE = 50

export function SourcesListClient({
  initialSources,
  initialLinks,
  initialResolved,
  isDevMode,
}: {
  initialSources: Source[]
  initialLinks: SourceLink[]
  initialResolved: Map<string, ResolvedTarget>
  isDevMode: boolean
}) {
  const [sources, setSources] = useState(initialSources)
  const [links, setLinks] = useState(initialLinks)
  const [resolved, setResolved] = useState(initialResolved)
  const [addingSource, setAddingSource] = useState(false)
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const linksBySource = useMemo(() => {
    const map = new Map<string, SourceLink[]>()
    links.forEach((l) => {
      const list = map.get(l.source_code) ?? []
      list.push(l)
      map.set(l.source_code, list)
    })
    return map
  }, [links])

  const filteredSources = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sources
    return sources.filter((s) =>
      [
        s.source_code,
        s.type,
        s.author1_zh,
        s.author1_en,
        s.author2_zh,
        s.author2_en,
        s.author3_zh,
        s.author3_en,
        s.editor_zh,
        s.title_zh,
        s.title_en,
        s.book_zh,
        s.citation_zh,
        s.citation_en,
        s.publication_zh,
        s.publication_en,
        s.note_zh,
        s.note_en,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    )
  }, [sources, query])

  const totalPages = Math.max(1, Math.ceil(filteredSources.length / PAGE_SIZE))
  // A delete (or a search that no longer matches as many results) can leave
  // `currentPage` past the end -- clamp for rendering rather than showing an
  // empty page; the stored value only snaps back once the user navigates.
  const clampedPage = Math.min(currentPage, totalPages)
  const pageSources = filteredSources.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  function handleSourceUpdated(updated: Source) {
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  function handleSourceDeleted(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleLinkAdded(link: SourceLink) {
    setLinks((prev) => [...prev, link])
    const { resolveSourceLinkTargets } = await import('@/lib/admin/resolve-source-link-target')
    const newResolved = await resolveSourceLinkTargets([link])
    setResolved((prev) => new Map([...prev, ...newResolved]))
  }

  function handleLinkDeleted(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  async function handleCreateSource(prev: ActionState<Source>, formData: FormData): Promise<ActionState<Source>> {
    const result = await createSource(prev, formData)
    if (result.ok) {
      setSources((s) => [result.data, ...s])
      setAddingSource(false)
    }
    return result
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCurrentPage(1)
          }}
          placeholder="Search by code, author, title, publication, or citation text…"
          className="w-full rounded border border-brand/30 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
        />
        <p className="text-xs text-gray-500">
          {query.trim() ? `${filteredSources.length} of ${sources.length} sources` : `${sources.length} sources`}
          {totalPages > 1 && ` · page ${clampedPage} of ${totalPages}`}
        </p>
      </div>

      {isDevMode && (
        <div>
          {!addingSource ? (
            <button
              type="button"
              onClick={() => setAddingSource(true)}
              className="rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-light"
            >
              + Add source
            </button>
          ) : (
            <div className="panel-record-item p-4 text-sm">
              <EditableSection
                data={BLANK_SOURCE}
                isDevMode
                startInEditing
                action={handleCreateSource}
                onCancelCreate={() => setAddingSource(false)}
                renderDisplay={() => null}
                renderForm={(s) => <SourceFields source={s} />}
              />
            </div>
          )}
        </div>
      )}

      {filteredSources.length === 0 ? (
        <p className="text-sm italic text-gray-500">
          {sources.length === 0 ? 'No sources catalogued yet.' : 'No sources match this search.'}
        </p>
      ) : (
        pageSources.map((source, index) => (
          <SourceCard
            key={source.id}
            source={source}
            links={linksBySource.get(source.source_code) ?? []}
            resolved={resolved}
            isDevMode={isDevMode}
            index={(clampedPage - 1) * PAGE_SIZE + index}
            onSourceUpdated={handleSourceUpdated}
            onSourceDeleted={() => handleSourceDeleted(source.id)}
            onLinkAdded={handleLinkAdded}
            onLinkDeleted={handleLinkDeleted}
          />
        ))
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2 text-sm">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, clampedPage - 1))}
            disabled={clampedPage <= 1}
            className="rounded border border-brand/30 bg-white px-3 py-1.5 text-brand transition hover:bg-brand-light disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-white"
          >
            Prev
          </button>
          <span className="text-gray-500">
            Page {clampedPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(totalPages, clampedPage + 1))}
            disabled={clampedPage >= totalPages}
            className="rounded border border-brand/30 bg-white px-3 py-1.5 text-brand transition hover:bg-brand-light disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-white"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
