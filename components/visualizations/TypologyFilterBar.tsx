'use client'

/**
 * Not a map itself — the coin-type filter control (category / major
 * category / subcategory / type / variant / inscription dropdowns), backed
 * by the live coin_type_hierarchy table.
 *
 * Used by: FindSpotsVisualization and MintTownVisualization in
 * components/visualizations/MapVisualization.tsx (the find-site and
 * mint-town pages).
 */

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import {
  emptyTypologySelection,
  getInscriptionOptions,
  getLevelOptions,
  optionLabel,
  type HierarchyLevelOption,
  type InscriptionSourceRow,
  type TypologyFilterSelection,
  type TypologyOptionCounts,
} from '@/lib/typology-filter'
import type { CoinTypeHierarchyRow } from '@/lib/types'

type TypologyFilterBarProps = {
  sel: TypologyFilterSelection
  onChange: (sel: TypologyFilterSelection) => void
  /** Show inscription list below dropdowns (find spots page). */
  showInscriptionList?: boolean
  hierarchyRows: CoinTypeHierarchyRow[]
  /** The real coin_issues catalog on Find Site / Mint Town; a
   * museum-scoped stand-in (buildAnsInscriptionSource) on Museum
   * Collections — see InscriptionSourceRow's doc comment. */
  coinIssues: InscriptionSourceRow[]
  /** Counts to show beside each option, e.g. "Coin (142)" — sites on Find
   * Site, recorded specimen quantity on the Mint Town tabs (database and
   * Museum Collections alike). See TypologyOptionCounts' doc comment. */
  optionCounts?: TypologyOptionCounts
  compact?: boolean
  /** Locks the current `sel` in as a committed multiselect pick and resets
   * `sel` back to empty — rendered as an "Add" button alongside the
   * dropdowns. Omitted by callers that only need a single selection. */
  onAddAnother?: () => void
  canAddAnother?: boolean
  /** Clears the active filter — rendered as a "Clear filter" button next to
   * Add, shown only while `showClearFilters` is true. */
  onClearFilters?: () => void
  showClearFilters?: boolean
}

const LEVEL_DICT_KEY: DictionaryKey[] = [
  'map.filter.l0',
  'map.filter.l1',
  'map.filter.l2',
  'map.filter.l3',
  'map.filter.l4',
]

export function TypologyFilterBar({
  sel,
  onChange,
  hierarchyRows,
  coinIssues,
  optionCounts,
  compact = false,
  onAddAnother,
  canAddAnother,
  onClearFilters,
  showClearFilters,
}: TypologyFilterBarProps) {
  const { lang, t } = useLanguage()

  const level1Options = getLevelOptions(hierarchyRows, sel, 1)
  const level2Options = getLevelOptions(hierarchyRows, sel, 2)
  const level3Options = getLevelOptions(hierarchyRows, sel, 3)
  const level4Options = getLevelOptions(hierarchyRows, sel, 4)
  const level5Options = getLevelOptions(hierarchyRows, sel, 5)
  const inscriptionOptions = getInscriptionOptions(coinIssues, hierarchyRows, sel)

  const toOptions = (opts: HierarchyLevelOption[], depth: 1 | 2 | 3 | 4 | 5) =>
    opts.map((o) => {
      const label = optionLabel(o.label_zh, o.label_en, lang)
      return { value: o.value, label: optionCounts ? `${label} (${optionCounts.level(depth, o.value)})` : label }
    })

  // Levels 2-5 all follow the same cascade rule: only shown once the level
  // above it is picked and has narrower options below it, and picking one
  // clears every deeper level (they're no longer valid once an ancestor
  // changes). Level 1 is special-cased above/below since it resets the
  // whole selection instead of just its own descendants.
  const cascadeLevels: Array<{ depth: 2 | 3 | 4 | 5; prevValue: string; value: string; options: HierarchyLevelOption[] }> = [
    { depth: 2, prevValue: sel.level1, value: sel.level2, options: level2Options },
    { depth: 3, prevValue: sel.level2, value: sel.level3, options: level3Options },
    { depth: 4, prevValue: sel.level3, value: sel.level4, options: level4Options },
    { depth: 5, prevValue: sel.level4, value: sel.level5, options: level5Options },
  ]

  function renderCascadeLevel({ depth, prevValue, value, options }: (typeof cascadeLevels)[number]) {
    if (!prevValue || options.length === 0) return null
    return (
      <FilterSelect
        key={depth}
        label={t(LEVEL_DICT_KEY[depth - 1])}
        value={value}
        options={toOptions(options, depth)}
        onChange={(v) => {
          const next = { ...sel, [`level${depth}`]: v }
          for (let d = depth + 1; d <= 5; d++) next[`level${d}` as keyof TypologyFilterSelection] = ''
          onChange(next)
        }}
      />
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-col gap-2">
        <FilterSelect
          label={t(LEVEL_DICT_KEY[0])}
          value={sel.level1}
          options={toOptions(level1Options, 1)}
          onChange={(v) => onChange({ ...emptyTypologySelection(), level1: v, inscriptionId: sel.inscriptionId })}
        />
        {cascadeLevels.map(renderCascadeLevel)}

        <FilterSelect
          label={t('map.filter.inscription', { count: inscriptionOptions.length })}
          value={sel.inscriptionId}
          options={inscriptionOptions.map((e) => {
            const label = formatInscriptionOptionLabel(e)
            return { value: e.id, label: optionCounts ? `${label} (${optionCounts.inscription(e.id)})` : label }
          })}
          onChange={(v) => onChange({ ...sel, inscriptionId: v })}
        />
      </div>

      {(onAddAnother || (onClearFilters && showClearFilters)) && (
        <div className="flex flex-wrap items-center gap-2">
          {onAddAnother && (
            <button
              type="button"
              onClick={onAddAnother}
              disabled={!canAddAnother}
              className="rounded border border-brand/30 bg-background px-2 py-0.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-brand"
            >
              {t('map.filter.addSelection')}
            </button>
          )}
          {onClearFilters && showClearFilters && (
            <button type="button" onClick={onClearFilters} className="btn-clear-filters">
              {t('heatmap.clearFilter')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function formatInscriptionOptionLabel(opt: { zh: string; en: string; mint_zh: string | null }) {
  let label = opt.en && opt.en !== opt.zh ? `${opt.zh} · ${opt.en}` : opt.zh
  if (opt.mint_zh) label += ` (${opt.mint_zh})`
  return label
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const { t } = useLanguage()

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-sm font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded form-input px-2 py-1.5"
      >
        <option value="">{`${label} – ${t('map.filter.none')}`}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
