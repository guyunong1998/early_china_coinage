'use client'

import { useMemo, useState } from 'react'
import { createSource } from '@/lib/admin/sources-actions'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { ActionState } from '@/lib/admin/types'
import type { Source, SourceLink } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { FieldLabel, fieldInputClass } from '@/components/edit/FieldRow'
import { SourceCard } from './SourceCard'

const BLANK_SOURCE: Source = {
  id: '',
  source_code: '',
  author_zh: null,
  author_en: null,
  title_zh: null,
  title_en: null,
  language: null,
  year: null,
  publication_zh: null,
  publication_en: null,
  page: null,
  citation_zh: null,
  citation_en: null,
  url: null,
  note_zh: null,
  note_en: null,
}

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
        s.author_zh,
        s.author_en,
        s.title_zh,
        s.title_en,
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, author, title, publication, or citation text…"
          className="w-full rounded border border-brand/30 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
        />
        <p className="text-xs text-gray-500">
          {query.trim()
            ? `${filteredSources.length} of ${sources.length} sources`
            : `${sources.length} sources`}
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
                renderForm={(s) => <SourceFormFieldsForCreate source={s} />}
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
        filteredSources.map((source, index) => (
          <SourceCard
            key={source.id}
            source={source}
            links={linksBySource.get(source.source_code) ?? []}
            resolved={resolved}
            isDevMode={isDevMode}
            index={index}
            onSourceUpdated={handleSourceUpdated}
            onSourceDeleted={() => handleSourceDeleted(source.id)}
            onLinkAdded={handleLinkAdded}
            onLinkDeleted={handleLinkDeleted}
          />
        ))
      )}
    </div>
  )
}

/** A trimmed-down subset of SourceCard's edit fields (SourceFields isn't
 * exported) — enough to create a usable source; the rest can be filled in
 * via Edit afterward. */
function SourceFormFieldsForCreate({ source }: { source: Partial<Source> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldLabel>Source code</FieldLabel>
        <input name="source_code" defaultValue={source.source_code ?? ''} required autoFocus className={fieldInputClass} />
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
        <FieldLabel>Year</FieldLabel>
        <input name="year" type="number" defaultValue={source.year ?? ''} className={fieldInputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Citation (zh)</FieldLabel>
        <textarea name="citation_zh" defaultValue={source.citation_zh ?? ''} rows={2} className={fieldInputClass} />
      </div>
    </div>
  )
}
