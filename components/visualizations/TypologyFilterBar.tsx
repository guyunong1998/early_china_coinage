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
  type InscriptionSourceRow,
  type TypologyFilterSelection,
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
  compact?: boolean
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
  compact = false,
}: TypologyFilterBarProps) {
  const { lang, t } = useLanguage()

  const level1Options = getLevelOptions(hierarchyRows, sel, 1)
  const level2Options = getLevelOptions(hierarchyRows, sel, 2)
  const level3Options = getLevelOptions(hierarchyRows, sel, 3)
  const level4Options = getLevelOptions(hierarchyRows, sel, 4)
  const level5Options = getLevelOptions(hierarchyRows, sel, 5)
  const inscriptionOptions = getInscriptionOptions(coinIssues, hierarchyRows, sel)

  const toOptions = (opts: { value: string; label_zh: string; label_en: string }[]) =>
    opts.map((o) => ({ value: o.value, label: optionLabel(o.label_en, o.label_zh, lang) }))

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-start gap-2.5">
        <FilterSelect
          label={t(LEVEL_DICT_KEY[0])}
          value={sel.level1}
          options={toOptions(level1Options)}
          onChange={(v) => onChange({ ...emptyTypologySelection(), level1: v, inscriptionId: sel.inscriptionId })}
        />
        {sel.level1 && level2Options.length > 0 && (
          <FilterSelect
            label={t(LEVEL_DICT_KEY[1])}
            value={sel.level2}
            options={toOptions(level2Options)}
            onChange={(v) => onChange({ ...sel, level2: v, level3: '', level4: '', level5: '' })}
          />
        )}
        {sel.level2 && level3Options.length > 0 && (
          <FilterSelect
            label={t(LEVEL_DICT_KEY[2])}
            value={sel.level3}
            options={toOptions(level3Options)}
            onChange={(v) => onChange({ ...sel, level3: v, level4: '', level5: '' })}
          />
        )}
        {sel.level3 && level4Options.length > 0 && (
          <FilterSelect
            label={t(LEVEL_DICT_KEY[3])}
            value={sel.level4}
            options={toOptions(level4Options)}
            onChange={(v) => onChange({ ...sel, level4: v, level5: '' })}
          />
        )}
        {sel.level4 && level5Options.length > 0 && (
          <FilterSelect
            label={t(LEVEL_DICT_KEY[4])}
            value={sel.level5}
            options={toOptions(level5Options)}
            onChange={(v) => onChange({ ...sel, level5: v })}
          />
        )}

        <FilterSelect
          label={t('map.filter.inscription', { count: inscriptionOptions.length })}
          value={sel.inscriptionId}
          options={inscriptionOptions.map((e) => ({
            value: e.id,
            label: formatInscriptionOptionLabel(e),
          }))}
          onChange={(v) => onChange({ ...sel, inscriptionId: v })}
        />
      </div>
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
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
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
