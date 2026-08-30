'use client'

import { useMemo, useState } from 'react'
import { ContextCard } from '@/components/site/ContextCard'
import { CoinTypePieChart, type PieChild, type PieGroup } from '@/components/site/CoinTypePieChart'
import { FindRow } from '@/components/site/FindRow'
import { CitationsSection } from '@/components/sources/CitationsSection'
import { ClickHint } from '@/components/ui/ClickHint'
import { Tabs } from '@/components/ui/Tabs'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { ResolvedTarget } from '@/lib/admin/resolve-source-link-target'
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

type UnquantifiedType = {
  typeZh: string
  typeEn: string | null
  inscriptionZh: string
  inscriptionEn: string | null
  recordCount: number
}

/**
 * The complement of buildContextBreakdown: every type/inscription combo
 * that shows up only in presence-only finds (no recorded quantity), so it
 * never contributes to the pie chart or the context's coin total. Surfaced
 * separately — a site can have real inscription diversity that's otherwise
 * invisible because none of those particular finds were ever counted.
 */
function buildUnquantifiedTypes(findsForContext: Find[]): UnquantifiedType[] {
  const withoutQuantity = findsForContext.filter((f) => findQuantity(f) == null || (findQuantity(f) ?? 0) <= 0)

  const byKey = new Map<string, UnquantifiedType>()
  withoutQuantity.forEach((find) => {
    const type = coinTypeLabel(find)
    const insc = inscriptionLabel(find)
    const key = `${type.zh}__${insc.zh}`
    const existing = byKey.get(key)
    if (existing) {
      existing.recordCount += 1
    } else {
      byKey.set(key, { typeZh: type.zh, typeEn: type.en, inscriptionZh: insc.zh, inscriptionEn: insc.en, recordCount: 1 })
    }
  })

  return [...byKey.values()].sort(
    (a, b) => a.typeZh.localeCompare(b.typeZh, 'zh-CN') || a.inscriptionZh.localeCompare(b.inscriptionZh, 'zh-CN')
  )
}

type SiteDetailTabsProps = {
  siteCode: string
  contexts: Context[]
  finds: Find[]
  isDevMode: boolean
  coinIssues?: CoinIssueDisplay[]
  structuredSourceLinks?: SourceLink[]
  sourcesByCode?: Map<string, Source>
  resolvedTargets?: Map<string, ResolvedTarget>
  /** find.coin_issues.coin_type_hierarchy_id → /coin-types/[slug], for
   * linking a find row's Type cell straight to its catalog entry. */
  coinTypeHrefByHierarchyId?: Map<string, string>
  /** find.coin_issues.mint_id → /mints/[mint_code], for linking a find
   * row's Mint cell straight to its mint-town record. */
  mintHrefByMintId?: Map<string, string>
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

/** A tab label with a click-to-reveal explanation of what the tab actually
 * contains — "Contexts" and "Finds" both name database concepts that aren't
 * self-explanatory from the word alone. */
function tabLabel(label: string, count: number, hint: string) {
  return (
    <span className="inline-flex items-center gap-1">
      <ClickHint hint={hint} className="cursor-help underline decoration-dotted underline-offset-2">
        {label}
      </ClickHint>
      {` (${count})`}
    </span>
  )
}

export function SiteDetailTabs({
  siteCode,
  contexts: initialContexts,
  finds: initialFinds,
  isDevMode,
  coinIssues = [],
  structuredSourceLinks = [],
  sourcesByCode = new Map(),
  resolvedTargets = new Map(),
  coinTypeHrefByHierarchyId = new Map(),
  mintHrefByMintId = new Map(),
}: SiteDetailTabsProps) {
  const { t } = useLanguage()
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
        <p className="text-sm text-gray-500 italic">{t('siteTabs.noContexts')}</p>
      ) : (
        filteredContexts.map((ctx) => {
          const findsForContext = finds.filter((f) => f.context_code === ctx.context_code)
          const breakdown = buildContextBreakdown(findsForContext)
          const unquantifiedTypes = buildUnquantifiedTypes(findsForContext)
          const totalCoins = findsForContext.reduce((sum, f) => sum + (findQuantity(f) ?? 0), 0)

          return (
            <ContextCard
              key={ctx.context_code}
              ctx={ctx}
              siteCode={siteCode}
              isDevMode={isDevMode}
              totalCoins={findsForContext.length > 0 ? totalCoins : null}
              onSaved={replaceContext}
              onDeleted={() => removeContext(ctx.id)}
              breakdownSlot={
                (breakdown || unquantifiedTypes.length > 0) && (
                  <div className="border-t border-gray-100 pt-3 md:border-t-0 md:border-l md:pl-4 md:pt-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      币种构成 / Coin types
                    </p>
                    <CoinTypePieChart
                      data={breakdown ?? []}
                      unquantified={unquantifiedTypes.map((t) => ({
                        label: t.typeZh,
                        labelEn: t.typeEn,
                        inscriptionLabel: t.inscriptionZh,
                        inscriptionLabelEn: t.inscriptionEn,
                        count: t.recordCount,
                      }))}
                    />
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
        <table className="min-w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[16%]" />
            <col className="w-[17%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 pr-4">{t('siteTabs.table.find')}</th>
              <th className="py-2 pr-4">{t('siteTabs.table.context')}</th>
              <th className="py-2 pr-4">{t('siteTabs.table.type')}</th>
              <th className="py-2 pr-4">{t('siteTabs.table.inscription')}</th>
              <th className="py-2 pr-4">{t('siteTabs.table.state')}</th>
              <th className="py-2 pr-4">{t('siteTabs.table.mint')}</th>
              <th className="py-2 text-right">{t('siteTabs.table.qty')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredFinds.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-sm italic text-gray-400">
                  {t('siteTabs.noFinds')}
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
                  coinTypeHrefByHierarchyId={coinTypeHrefByHierarchyId}
                  mintHrefByMintId={mintHrefByMintId}
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


  const contextFilter = hasMultipleContexts && (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="context-filter" className="font-semibold text-gray-700">
        {t('siteTabs.filterByContexts')}
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
  )

  return (
    <div className="space-y-3">
      <Tabs
        headerExtra={contextFilter}
        tabs={[
          {
            id: 'contexts',
            label: tabLabel(t('siteTabs.tab.contexts'), filteredContexts.length, t('siteTabs.tab.contextsHint')),
            content: contextsContent,
          },
          {
            id: 'finds',
            label: tabLabel(t('siteTabs.tab.finds'), filteredFinds.length, t('siteTabs.tab.findsHint')),
            content: findsContent,
          },
          {
            id: 'source-links',
            label: `${t('siteTabs.tab.sources')} (${structuredSourceLinks.length})`,
            content: (
              <CitationsSection
                targetType="site"
                targetCode={siteCode}
                targetLabel={siteCode}
                initialLinks={structuredSourceLinks}
                sourcesByCode={sourcesByCode}
                resolvedTargets={resolvedTargets}
                isDevMode={isDevMode}
                filterContextCode={selectedContext === 'all' ? null : selectedContext}
                contextOrder={contexts.map((c) => c.context_code)}
                contextNamesByCode={new Map(contexts.map((c) => [c.context_code, c.context_name_zh]))}
                findContextByCode={new Map(finds.map((f) => [f.find_code, f.context_code]))}
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
