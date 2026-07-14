'use client'

import { useMemo, useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { displayValue, formatNumber } from '@/lib/format'
import type { Context, Find, Source } from '@/lib/types'
import type { MapSite, Site } from '@/lib/types'

type SiteDetailTabsProps = {
  site: Site
  summary: MapSite | null
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

function Row({ labelKey, children }: { labelKey: DictionaryKey; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">
        <T k={labelKey} />
      </dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

export function SiteDetailTabs({
  site,
  summary,
  contexts,
  finds,
  sources,
}: SiteDetailTabsProps) {
  const { t } = useLanguage()
  const [selectedContext, setSelectedContext] = useState<string>(() =>
    contexts.length === 1 ? contexts[0].context_code : 'all'
  )
  const hasMultipleContexts = contexts.length > 1
  const selectedContextItem =
    selectedContext === 'all'
      ? null
      : contexts.find((ctx) => ctx.context_code === selectedContext) ?? null

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

  // ── Details tab ──────────────────────────────────────────────────────────
  const detailsContent = (
    <dl>
      <Row labelKey="siteTabs.row.majorTypes">{displayValue(summary?.major_types_zh)}</Row>
      <Row labelKey="siteTabs.row.minorTypes">{displayValue(summary?.minor_types_zh)}</Row>
      <Row labelKey="siteTabs.row.inscriptions">{displayValue(summary?.inscriptions)}</Row>
      <Row labelKey="siteTabs.row.states">{displayValue(summary?.states_zh)}</Row>
      <Row labelKey="siteTabs.row.mints">{displayValue(summary?.mints_zh)}</Row>
      <Row labelKey="siteTabs.row.precision">{displayValue(site.precision_level ?? summary?.precision_level)}</Row>
      <Row labelKey="siteTabs.row.contextDescription">
        {selectedContextItem ? (
          biBlock(selectedContextItem.description_zh, selectedContextItem.description_en)
        ) : hasMultipleContexts ? (
          <span className="text-gray-500 italic">
            <T k="siteTabs.selectContext" />
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Row>
    </dl>
  )

  // ── Contexts tab ─────────────────────────────────────────────────────────
  const contextsContent = (
    <div className="space-y-4">
      {filteredContexts.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          <T k="siteTabs.noContexts" />
        </p>
      ) : (
        filteredContexts.map((ctx) => (
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
            {(ctx.description_zh || ctx.description_en) && (
              <div className="mt-2 text-sm">{biBlock(ctx.description_zh, ctx.description_en)}</div>
            )}
            {(ctx.note_zh || ctx.note_en) && (
              <div className="mt-1 text-xs text-gray-400">
                {biBlock(ctx.note_zh, ctx.note_en)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )

  // ── Finds tab ────────────────────────────────────────────────────────────
  const findsContent = (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-2 pr-4">
              <T k="siteTabs.table.find" />
            </th>
            <th className="py-2 pr-4">
              <T k="siteTabs.table.context" />
            </th>
            <th className="py-2 pr-4">
              <T k="siteTabs.table.type" />
            </th>
            <th className="py-2 pr-4">
              <T k="siteTabs.table.inscription" />
            </th>
            <th className="py-2 pr-4">
              <T k="siteTabs.table.state" />
            </th>
            <th className="py-2 pr-4">
              <T k="siteTabs.table.mint" />
            </th>
            <th className="py-2 text-right">
              <T k="siteTabs.table.qty" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filteredFinds.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-4 text-center text-sm italic text-gray-400">
                <T k="siteTabs.noFinds" />
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
        <p className="text-sm italic text-gray-500">
          <T k="siteTabs.noSources" />
        </p>
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
            <T k="siteTabs.context.label" />
          </label>
          <select
            id="context-filter"
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            className="rounded border border-brand/30 bg-white px-2 py-1 text-sm outline-none focus:border-brand"
          >
            <option value="all">{t('siteTabs.context.all')}</option>
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
          { id: 'details', label: t('siteTabs.tab.details'), content: detailsContent },
          {
            id: 'contexts',
            label: `${t('siteTabs.tab.contexts')} (${filteredContexts.length})`,
            content: contextsContent,
          },
          {
            id: 'finds',
            label: `${t('siteTabs.tab.finds')} (${filteredFinds.length})`,
            content: findsContent,
          },
          {
            id: 'references',
            label: `${t('siteTabs.tab.references')} (${uniqueSources.length})`,
            content: referencesContent,
          },
        ]}
      />
    </div>
  )
}
