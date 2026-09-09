'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { deleteSourceLink } from '@/lib/admin/source-links-actions'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import type { Source, SourceLink } from '@/lib/types'
import { formatSourceCitation, sourceDisplayType } from '@/lib/format-citation'
import { AddSourceLinkForm } from '@/components/sources/AddSourceLinkForm'
import { ConfirmDeleteButton } from '@/components/edit/ConfirmDeleteButton'
import { T } from '@/components/i18n/T'

const URL_SPLIT = /(https?:\/\/[^\s，。,;；]+)/

function CitationText({ text }: { text: string }) {
  const parts = text.split(URL_SPLIT)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('http') ? (
          <a
            key={`${part}-${i}`}
            href={part}
            className="break-all text-brand hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        )
      )}
    </>
  )
}

type CitationGroup = {
  key: string
  kind: 'context' | 'site' | 'mint' | 'other'
  contextCode: string | null
  contextName: string | null
  headingLabel: string
  headingHref: string | null
  links: SourceLink[]
}

function contextForLink(
  link: SourceLink,
  target: ResolvedTarget | undefined,
  findContextByCode: Map<string, string>,
  contextNamesByCode: Map<string, string | null>
): { code: string | null; name: string | null } {
  if (link.target_type === 'context') {
    return {
      code: link.target_code,
      name: contextNamesByCode.get(link.target_code) ?? nameFromLabel(target?.label, link.target_code),
    }
  }
  if (link.target_type === 'find') {
    const code = findContextByCode.get(link.target_code) ?? null
    return { code, name: code ? (contextNamesByCode.get(code) ?? null) : null }
  }
  return { code: null, name: null }
}

function nameFromLabel(label: string | undefined, code: string): string | null {
  if (!label) return null
  const prefix = `${code} · `
  return label.startsWith(prefix) ? label.slice(prefix.length) : null
}

function groupKeyFor(
  link: SourceLink,
  contextCode: string | null
): string {
  if (contextCode) return `context:${contextCode}`
  if (link.target_type === 'site') return `site:${link.target_code}`
  if (link.target_type === 'mint') return `mint:${link.target_code}`
  return `${link.target_type}:${link.target_code}`
}

function groupLinks(
  links: SourceLink[],
  resolvedTargets: Map<string, ResolvedTarget>,
  contextOrder: string[],
  findContextByCode: Map<string, string>,
  contextNamesByCode: Map<string, string | null>
): CitationGroup[] {
  const groups = new Map<string, CitationGroup>()
  const seenCitation = new Set<string>()

  const ranked = [...links].sort((a, b) => {
    const rank = (link: SourceLink) =>
      link.target_type === 'context' || link.target_type === 'find' ? 0 : link.target_type === 'site' ? 1 : 2
    return rank(a) - rank(b)
  })

  ranked.forEach((link) => {
    const citationKey = `${link.source_code}|${link.page ?? ''}`
    if (seenCitation.has(citationKey)) return
    seenCitation.add(citationKey)

    const target = resolvedTargets.get(`${link.target_type}:${link.target_code}`)
    const ctx = contextForLink(link, target, findContextByCode, contextNamesByCode)
    const key = groupKeyFor(link, ctx.code)
    const existing = groups.get(key)
    if (existing) {
      existing.links.push(link)
      return
    }

    const kind: CitationGroup['kind'] = ctx.code
      ? 'context'
      : link.target_type === 'site'
        ? 'site'
        : link.target_type === 'mint'
          ? 'mint'
          : 'other'

    groups.set(key, {
      key,
      kind,
      contextCode: ctx.code,
      contextName: ctx.name,
      headingLabel: target?.label ?? link.target_code,
      headingHref: target?.href ?? null,
      links: [link],
    })
  })

  const orderIndex = new Map(contextOrder.map((code, i) => [code, i]))
  return [...groups.values()].sort((a, b) => {
    const rank = (g: CitationGroup) =>
      g.kind === 'site' ? 0 : g.kind === 'context' ? 1 : g.kind === 'mint' ? 2 : 3
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    if (a.kind === 'context' && b.kind === 'context') {
      const ai = a.contextCode != null ? (orderIndex.get(a.contextCode) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
      const bi = b.contextCode != null ? (orderIndex.get(b.contextCode) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
      if (ai !== bi) return ai - bi
      return (a.contextCode ?? '').localeCompare(b.contextCode ?? '')
    }
    return a.headingLabel.localeCompare(b.headingLabel, 'zh-CN')
  })
}

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
  filterContextCode,
  contextOrder = [],
  contextNamesByCode = new Map(),
  findContextByCode = new Map(),
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
  /** When set, only citations for this context (plus site-level ones) are shown. */
  filterContextCode?: string | null
  /** Site context_code order, used to keep reference groups in the same
   * sequence as the Contexts tab. */
  contextOrder?: string[]
  contextNamesByCode?: Map<string, string | null>
  findContextByCode?: Map<string, string>
}) {
  const [links, setLinks] = useState(initialLinks)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const visibleLinks = useMemo(() => {
    if (!filterContextCode || filterContextCode === 'all') return links
    return links.filter((link) => {
      if (link.target_type === 'site') return true
      if (link.target_type === 'context') return link.target_code === filterContextCode
      if (link.target_type === 'find') return findContextByCode.get(link.target_code) === filterContextCode
      return false
    })
  }, [links, filterContextCode, findContextByCode])

  const groups = useMemo(
    () => groupLinks(visibleLinks, resolvedTargets, contextOrder, findContextByCode, contextNamesByCode),
    [visibleLinks, resolvedTargets, contextOrder, findContextByCode, contextNamesByCode]
  )

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteSourceLink(id)
    setDeletingId(null)
    if (result.ok) setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  function renderCitation(link: SourceLink) {
    const source = sourcesByCode.get(link.source_code)
    const typeLabel = source ? sourceDisplayType(source) : ''
    return (
      <article key={link.id} className="panel-record-item p-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold text-brand">{link.source_code}</p>
          {isDevMode && (
            <ConfirmDeleteButton pending={deletingId === link.id} onConfirm={() => handleDelete(link.id)} />
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          <span className="font-semibold text-gray-600">
            <T k="siteTabs.citation.type" />
          </span>
          {': '}
          {typeLabel || <span className="italic text-gray-400"><T k="siteTabs.citation.noType" /></span>}
        </p>
        {source ? (
          <p className="mt-1 leading-6 text-gray-800">
            <CitationText text={formatSourceCitation(source, link.page)} />
          </p>
        ) : (
          <p className="mt-1 italic text-gray-400">Source not found.</p>
        )}
        {(link.note_zh || link.note_en) && (
          <p className="mt-1 text-xs text-gray-500">{link.note_zh || link.note_en}</p>
        )}
      </article>
    )
  }

  function renderGroupHeading(group: CitationGroup) {
    if (group.kind === 'mint') return null

    if (group.kind === 'context') {
      const name = group.contextName?.trim()
      const code = group.contextCode
      return (
        <div className="mb-2 text-sm text-gray-700">
          <p>
            <span className="font-semibold">
              <T k="siteTabs.citation.context" />
            </span>
            {': '}
            {name || <span className="italic text-gray-400">—</span>}
          </p>
          <p className="mt-0.5">
            <span className="font-semibold">
              <T k="siteTabs.citation.contextCode" />
            </span>
            {': '}
            <span className="font-mono text-xs">{code}</span>
          </p>
        </div>
      )
    }

    if (group.kind === 'site') {
      return (
        <div className="mb-2 text-sm text-gray-700">
          <p>
            <span className="font-semibold">
              <T k="siteTabs.citation.site" />
            </span>
            {': '}
            {group.headingHref ? (
              <Link href={group.headingHref} className="text-brand hover:underline">
                {group.headingLabel}
              </Link>
            ) : (
              group.headingLabel
            )}
          </p>
        </div>
      )
    }

    return (
      <div className="mb-2 text-xs text-gray-500">
        <span className="text-gray-400">[{group.kind}]</span> {group.headingLabel}
      </div>
    )
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

      {visibleLinks.length === 0 ? (
        <p className="text-sm italic text-gray-500">
          <T k="siteTabs.citation.noStructured" />
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            {renderGroupHeading(group)}
            {group.links.map(renderCitation)}
          </section>
        ))
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
