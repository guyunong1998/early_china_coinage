'use client'

import { useMemo, useState } from 'react'
import { ContextCard } from '@/components/site/ContextCard'
import { CoinTypePieChart, type PieChild, type PieGroup } from '@/components/site/CoinTypePieChart'
import { FindRow } from '@/components/site/FindRow'
import { SourceLinksSection } from '@/components/site/SourceLinksSection'
import { Tabs } from '@/components/ui/Tabs'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
import { displayValue } from '@/lib/format'
import type { CoinIssueDisplay, Context, Find, Source, SourceLink } from '@/lib/types'

function findQuantity(find: Find) {
  return find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? null
}

/** Level 1 of the chart: coin type (major/minor type). */
function coinTypeLabel(find: Find) {
  const zh =
    find.coin_issues?.minor_type_zh?.trim() ||
    find.coin_issues?.major_type_zh?.trim() ||
    find.description_zh?.trim() ||
    'Unclassified'
  const en = find.coin_issues?.minor_type_en?.trim() || find.coin_issues?.major_type_en?.trim() || null
  return { zh, en }
}

/** Level 2 of the chart: inscription, within its parent coin type. */
function inscriptionLabel(find: Find) {
  const raw = find.coin_issues?.inscription?.trim()
  if (raw) {
    return { zh: raw, en: find.coin_issues?.inscription_en?.trim() || null }
  }
  return { zh: '无铭文', en: 'No inscription recorded' }
}

function capChildren(
  children: PieChild[],
  max: number,
  otherLabelZh: (n: number) => string,
  otherLabelEn: (n: number) => string
): PieChild[] {
  const sorted = [...children].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return sorted
  const top = sorted.slice(0, max)
  const rest = sorted.slice(max)
  const otherTotal = rest.reduce((sum, c) => sum + c.value, 0)
  return [...top, { label: otherLabelZh(rest.length), labelEn: otherLabelEn(rest.length), value: otherTotal }]
}

function capGroups(
  groups: PieGroup[],
  max: number,
  otherLabelZh: (n: number) => string,
  otherLabelEn: (n: number) => string
): PieGroup[] {
  const sorted = [...groups].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return sorted
  const top = sorted.slice(0, max)
  const rest = sorted.slice(max)
  const otherTotal = rest.reduce((sum, g) => sum + g.value, 0)
  const otherChildren: PieChild[] = rest.map((g) => ({ label: g.label, labelEn: g.labelEn, value: g.value }))
  return [
    ...top,
    {
      label: otherLabelZh(rest.length),
      labelEn: otherLabelEn(rest.length),
      value: otherTotal,
      children: otherChildren,
    },
  ]
}

/**
 * Builds a two-level coin-type → inscription breakdown for the sector chart,
 * but only when the context's finds actually carry specific quantities — a
 * chart built from presence-only flags (no recorded counts) would be
 * misleading.
 */
function buildContextBreakdown(findsForContext: Find[]): PieGroup[] | null {
  const withQuantity = findsForContext.filter((f) => findQuantity(f) != null && (findQuantity(f) ?? 0) > 0)
  if (withQuantity.length === 0) return null

  const typeGroups = new Map<
    string,
    { labelEn: string | null; value: number; children: Map<string, PieChild> }
  >()

  withQuantity.forEach((find) => {
    const qty = findQuantity(find) ?? 0
    const type = coinTypeLabel(find)
    const insc = inscriptionLabel(find)

    if (!typeGroups.has(type.zh)) {
      typeGroups.set(type.zh, { labelEn: type.en, value: 0, children: new Map() })
    }
    const group = typeGroups.get(type.zh)!
    group.value += qty

    const existingChild = group.children.get(insc.zh)
    if (existingChild) {
      existingChild.value += qty
    } else {
      group.children.set(insc.zh, { label: insc.zh, labelEn: insc.en, value: qty })
    }
  })

  // Cap both levels so the legend stays readable — fold long tails into a
  // single "Other" bucket rather than repeating the color palette forever.
  const groups: PieGroup[] = capGroups(
    [...typeGroups.entries()].map(([zh, g]) => ({
      label: zh,
      labelEn: g.labelEn,
      value: g.value,
      children: capChildren(
        [...g.children.values()],
        6,
        (n) => `其他铭文 (${n})`,
        (n) => `Other inscriptions (${n})`
      ),
    })),
    8,
    (n) => `其他类型 (${n})`,
    (n) => `Other types (${n})`
  )

  return groups.length > 0 ? groups : null
}

type SiteDetailTabsProps = {
  siteCode: string
  contexts: Context[]
  finds: Find[]
  sources: Source[]
  isDevMode: boolean
  coinIssues?: CoinIssueDisplay[]
  structuredSourceLinks?: SourceLink[]
  sourcesByCode?: Map<string, Source>
  resolvedTargets?: Map<string, ResolvedTarget>
}

// ── bilingual helpers (same pattern as site page) ─────────────────────────

function bi(zh: string | null | undefined, en: string | null | undefined) {
  const a = zh?.trim()
  const b = en?.trim()
  if (!a && !b) return <span className="text-gray-400">—</span>
  if (!b || b === a) return <span>{a ?? '—'}</span>
  return (
    <span>
      {a}
      <span className="ml-2 text-sm italic text-gray-400">{b}</span>
    </span>
  )
}

function coinIssueOptionLabel(c: CoinIssueDisplay): string {
  const type = c.minor_type_zh ?? c.major_type_zh ?? c.inscription ?? c.coin_type_code
  return `${c.coin_type_code} — ${type ?? ''}`
}

export function SiteDetailTabs({
  siteCode,
  contexts: initialContexts,
  finds: initialFinds,
  sources,
  isDevMode,
  coinIssues = [],
  structuredSourceLinks = [],
  sourcesByCode = new Map(),
  resolvedTargets = new Map(),
}: SiteDetailTabsProps) {
  const [contexts, setContexts] = useState(initialContexts)
  const [finds, setFinds] = useState(initialFinds)
  const [addingContext, setAddingContext] = useState(false)
  const [addingFind, setAddingFind] = useState(false)

  const [selectedContext, setSelectedContext] = useState<string>(() =>
    initialContexts.length === 1 ? initialContexts[0].context_code : 'all'
  )
  const hasMultipleContexts = contexts.length > 1

  const filteredContexts = useMemo(
    () => (selectedContext === 'all' ? contexts : contexts.filter((ctx) => ctx.context_code === selectedContext)),
    [contexts, selectedContext]
  )

  const filteredFinds = useMemo(
    () => (selectedContext === 'all' ? finds : finds.filter((find) => find.context_code === selectedContext)),
    [finds, selectedContext]
  )

  const contextOptions = useMemo(
    () => contexts.map((c) => ({ context_code: c.context_code, label: `${c.context_code}${c.context_name_zh ? ` · ${c.context_name_zh}` : ''}` })),
    [contexts]
  )

  const coinIssueOptions: ComboOption[] = useMemo(
    () => coinIssues.map((c) => ({ value: c.id, label: coinIssueOptionLabel(c), searchText: c.inscription ?? '' })),
    [coinIssues]
  )

  function replaceContext(updated: Context) {
    setContexts((prev) => {
      const exists = prev.some((c) => c.id === updated.id)
      return exists ? prev.map((c) => (c.id === updated.id ? updated : c)) : [...prev, updated]
    })
    setAddingContext(false)
  }

  function removeContext(id: string) {
    setContexts((prev) => prev.filter((c) => c.id !== id))
    setFinds((prev) => prev.filter((f) => f.context_code !== contexts.find((c) => c.id === id)?.context_code))
  }

  function replaceFind(updated: Find) {
    setFinds((prev) => {
      const exists = prev.some((f) => f.id === updated.id)
      return exists ? prev.map((f) => (f.id === updated.id ? updated : f)) : [...prev, updated]
    })
    setAddingFind(false)
  }

  function removeFind(id: string) {
    setFinds((prev) => prev.filter((f) => f.id !== id))
  }

  // ── Contexts tab ─────────────────────────────────────────────────────────
  const contextsContent = (
    <div className="space-y-4">
      {isDevMode && (
        <div>
          {!addingContext ? (
            <button
              type="button"
              onClick={() => setAddingContext(true)}
              className="rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-light"
            >
              + Add context
            </button>
          ) : (
            <ContextCard
              siteCode={siteCode}
              isDevMode
              isNew
              onSaved={replaceContext}
              onCancelCreate={() => setAddingContext(false)}
            />
          )}
        </div>
      )}
      {filteredContexts.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No contexts recorded for this site.</p>
      ) : (
        filteredContexts.map((ctx) => {
          const findsForContext = finds.filter((f) => f.context_code === ctx.context_code)
          const breakdown = buildContextBreakdown(findsForContext)

          return (
            <ContextCard
              key={ctx.context_code}
              ctx={ctx}
              siteCode={siteCode}
              isDevMode={isDevMode}
              onSaved={replaceContext}
              onDeleted={() => removeContext(ctx.id)}
              breakdownSlot={
                breakdown && (
                  <div className="border-t border-gray-100 pt-3 md:border-t-0 md:border-l md:pl-4 md:pt-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      币种构成 / Coin types 
                    </p>
                    <CoinTypePieChart data={breakdown} />
                  </div>
                )
              }
            />
          )
        })
      )}
    </div>
  )

  // ── Finds tab ────────────────────────────────────────────────────────────
  const findsContent = (
    <div className="space-y-3">
      {isDevMode && contexts.length > 0 && (
        <div>
          {!addingFind ? (
            <button
              type="button"
              onClick={() => setAddingFind(true)}
              className="rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-light"
            >
              + Add find
            </button>
          ) : (
            <table className="min-w-full text-left text-sm">
              <tbody>
                <FindRow
                  contextCode={selectedContext !== 'all' ? selectedContext : contexts[0].context_code}
                  contextOptions={contextOptions}
                  isDevMode
                  coinIssueOptions={coinIssueOptions}
                  isNew
                  onSaved={replaceFind}
                  onCancelCreate={() => setAddingFind(false)}
                />
              </tbody>
            </table>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 pr-4">Find</th>
              <th className="py-2 pr-4">Context</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Inscription</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Mint</th>
              <th className="py-2 text-right">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredFinds.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-sm italic text-gray-400">
                  No find records for this site.
                </td>
              </tr>
            ) : (
              filteredFinds.map((find) => (
                <FindRow
                  key={find.find_code}
                  find={find}
                  contextCode={find.context_code}
                  contextOptions={contextOptions}
                  isDevMode={isDevMode}
                  coinIssueOptions={coinIssueOptions}
                  onSaved={replaceFind}
                  onDeleted={() => removeFind(find.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── References tab ───────────────────────────────────────────────────────
  const uniqueSources = useMemo(() => {
    const map = new Map<string, Source>()
    sources.forEach((source) => {
      if (!map.has(source.source_code)) {
        map.set(source.source_code, source)
      }
    })
    return [...map.values()]
  }, [sources])

  const referencesContent = (
    <div className="space-y-4">
      {uniqueSources.length === 0 ? (
        <p className="text-sm italic text-gray-500">No bibliographic sources linked yet.</p>
      ) : (
        uniqueSources.map((source, index) => (
          <article key={source.source_code} className="panel-record-item p-4 text-sm">
            <p className="text-xs font-semibold text-brand">
              [{index + 1}] {source.source_code}
            </p>
            <p className="mt-1 leading-6 text-gray-800">
              {source.citation_zh ??
                `${displayValue(source.author_zh, '')}${source.author_zh ? '：' : ''}${displayValue(
                  source.title_zh,
                  '—'
                )}`}
            </p>
            {source.title_en && (
              <p className="mt-1 leading-6 italic text-gray-500">{source.title_en}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {displayValue(source.publication_zh)}
              {source.year ? ` (${source.year})` : ''}
              {source.page ? `, p. ${source.page}` : ''}
            </p>
            {source.url && (
              <a
                href={source.url}
                className="mt-2 inline-block text-brand hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.url}
              </a>
            )}
          </article>
        ))
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {hasMultipleContexts && (
        <div className="border border-brand/20 bg-white px-3 py-2 text-sm">
          <label htmlFor="context-filter" className="mr-2 font-semibold text-gray-700">
            Archaeological unit:
          </label>
          <select
            id="context-filter"
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            className="rounded border border-brand/30 bg-white px-2 py-1 text-sm outline-none focus:border-brand"
          >
            <option value="all">All contexts</option>
            {contexts.map((ctx) => (
              <option key={ctx.context_code} value={ctx.context_code}>
                {ctx.context_code}
                {ctx.context_name_zh ? ` · ${ctx.context_name_zh}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'contexts', label: `Contexts (${filteredContexts.length})`, content: contextsContent },
          { id: 'finds', label: `Finds (${filteredFinds.length})`, content: findsContent },
          { id: 'references', label: `References (${uniqueSources.length})`, content: referencesContent },
          {
            id: 'source-links',
            label: `Sources & Citations (${structuredSourceLinks.length})`,
            content: (
              <SourceLinksSection
                siteCode={siteCode}
                initialLinks={structuredSourceLinks}
                sourcesByCode={sourcesByCode}
                resolvedTargets={resolvedTargets}
                isDevMode={isDevMode}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

// Re-export bi for backward-compat with any other importer expecting it from this module.
export { bi }
