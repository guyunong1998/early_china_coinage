'use client'

import { useMemo, useState } from 'react'
import { CoinTypePieChart, type PieChild, type PieGroup } from '@/components/site/CoinTypePieChart'
import { Tabs } from '@/components/ui/Tabs'
import { displayValue, formatNumber } from '@/lib/format'
import type { Context, Find, Source } from '@/lib/types'

function findQuantity(find: Find) {
  return find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? null
}

/** Level 1 of the chart: coin type (major/minor type). */
function coinTypeLabel(find: Find) {
  const zh =
    find.coin_types?.minor_type_zh?.trim() ||
    find.coin_types?.major_type_zh?.trim() ||
    find.description_zh?.trim() ||
    'Unclassified'
  const en = find.coin_types?.minor_type_en?.trim() || find.coin_types?.major_type_en?.trim() || null
  return { zh, en }
}

/** Level 2 of the chart: inscription, within its parent coin type. */
function inscriptionLabel(find: Find) {
  const raw = find.coin_types?.inscription?.trim()
  if (raw) {
    return { zh: raw, en: find.coin_types?.inscription_en?.trim() || null }
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
  contexts: Context[]
  finds: Find[]
  sources: Source[]
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

function biBlock(zh: string | null | undefined, en: string | null | undefined) {
  const a = zh?.trim()
  const b = en?.trim()
  if (!a && !b) return <span className="text-gray-400">—</span>
  return (
    <div className="space-y-1">
      {a && <p>{a}</p>}
      {b && b !== a && <p className="italic text-gray-500">{b}</p>}
    </div>
  )
}

export function SiteDetailTabs({
  contexts,
  finds,
  sources,
}: SiteDetailTabsProps) {
  const [selectedContext, setSelectedContext] = useState<string>(() =>
    contexts.length === 1 ? contexts[0].context_code : 'all'
  )
  const hasMultipleContexts = contexts.length > 1

  const filteredContexts = useMemo(
    () =>
      selectedContext === 'all'
        ? contexts
        : contexts.filter((ctx) => ctx.context_code === selectedContext),
    [contexts, selectedContext]
  )

  const filteredFinds = useMemo(
    () =>
      selectedContext === 'all'
        ? finds
        : finds.filter((find) => find.context_code === selectedContext),
    [finds, selectedContext]
  )

  // ── Contexts tab ─────────────────────────────────────────────────────────
  const contextsContent = (
    <div className="space-y-4">
      {filteredContexts.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No contexts recorded for this site.</p>
      ) : (
        filteredContexts.map((ctx) => {
          const findsForContext = finds.filter((f) => f.context_code === ctx.context_code)
          const breakdown = buildContextBreakdown(findsForContext)

          return (
            <div key={ctx.context_code} className="border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-brand">
                    {ctx.context_name_zh ?? ctx.context_code}
                  </h3>
                  {ctx.context_name_en && ctx.context_name_en !== ctx.context_name_zh && (
                    <p className="text-sm italic text-gray-500">{ctx.context_name_en}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-400">{ctx.context_code}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {bi(ctx.context_type_zh, ctx.context_type_en)}
                {(ctx.period_zh || ctx.period_en) && (
                  <span className="ml-3 text-gray-400">
                    · {bi(ctx.period_zh, ctx.period_en)}
                  </span>
                )}
              </p>

              <div className="mt-2 grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  {(ctx.description_zh || ctx.description_en) && (
                    <div className="text-sm">{biBlock(ctx.description_zh, ctx.description_en)}</div>
                  )}
                  {(ctx.note_zh || ctx.note_en) && (
                    <div className="mt-1 text-xs text-gray-400">
                      {biBlock(ctx.note_zh, ctx.note_en)}
                    </div>
                  )}
                </div>

                {breakdown && (
                  <div className="border-t border-gray-100 pt-3 md:border-t-0 md:border-l md:pl-4 md:pt-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Coin types / 币种构成
                    </p>
                    <CoinTypePieChart data={breakdown} />
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  // ── Finds tab ────────────────────────────────────────────────────────────
  const findsContent = (
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
              <tr key={find.find_code} className="align-top hover:bg-gray-50">
                <td className="py-2 pr-4 font-mono text-xs">{find.find_code}</td>
                <td className="py-2 pr-4 text-gray-500">{find.context_code}</td>
                <td className="py-2 pr-4">
                  {bi(
                    find.coin_types?.minor_type_zh ??
                      find.coin_types?.major_type_zh ??
                      find.description_zh,
                    find.coin_types?.minor_type_en ??
                      find.coin_types?.major_type_en ??
                      find.description_en
                  )}
                </td>
                <td className="py-2 pr-4">
                  {bi(find.coin_types?.inscription, find.coin_types?.inscription_en)}
                </td>
                <td className="py-2 pr-4">
                  {bi(find.coin_types?.state_zh, find.coin_types?.state_en)}
                </td>
                <td className="py-2 pr-4">
                  {bi(find.coin_types?.mint_zh, find.coin_types?.mint_en)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(find.quantity_total ?? find.quantity_min ?? find.quantity_estimated)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
          <article key={source.source_code} className="border border-gray-100 p-4 text-sm">
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
        ]}
      />
    </div>
  )
}
