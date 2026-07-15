'use client'

/**
 * Not a map itself — the coin-type filter control (major category / sub-
 * category / type / variant / inscription dropdowns).
 *
 * Used by: FindSpotsSidebar.tsx (app/visualizations/coin-type and
 * app/visualizations/mint pages).
 */

import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  emptyTypologySelection,
  getInscriptionOptions,
  getL1Options,
  getL2Options,
  getL3Options,
  getL4Options,
  isTypologyLeafSelection,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import type { CoinType } from '@/lib/types'

type TypologyFilterBarProps = {
  sel: TypologyFilterSelection
  onChange: (sel: TypologyFilterSelection) => void
  /** Show inscription list below dropdowns (find spots page). */
  showInscriptionList?: boolean
  /**
   * When Typology.xlsx has no inscription rows for a leaf category
   * (e.g. Round Coin), options are taken from these DB coin types.
   */
  coinTypes?: CoinType[]
  compact?: boolean
}

export function TypologyFilterBar({
  sel,
  onChange,
  showInscriptionList = false,
  coinTypes,
  compact = false,
}: TypologyFilterBarProps) {
  const { lang, t } = useLanguage()

  const l1Options = getL1Options(lang)
  const l2Options = getL2Options(sel, lang)
  const l3Options = getL3Options(sel, lang)
  const l4Options = getL4Options(sel, lang)
  const inscriptionOptions = getInscriptionOptions(sel, coinTypes)

  // Show inscriptions at any typology leaf — including L1-only categories
  // like Round Coin (圜钱) that have no L2/L3 children.
  const showInscriptions =
    showInscriptionList &&
    inscriptionOptions.length > 0 &&
    isTypologyLeafSelection(sel)

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-start gap-2.5">
        <FilterSelect
          label={t('map.filter.l1')}
          value={sel.l1}
          options={l1Options}
          onChange={(v) => onChange({ ...emptyTypologySelection(), l1: v })}
        />
        {sel.l1 && l2Options.length > 0 && (
          <FilterSelect
            label={t('map.filter.l2')}
            value={sel.l2}
            options={l2Options}
            onChange={(v) => onChange({ ...sel, l2: v, l3: '', l4: '', inscription: '' })}
          />
        )}
        {sel.l2 && l3Options.length > 0 && (
          <FilterSelect
            label={t('map.filter.l3')}
            value={sel.l3}
            options={l3Options}
            onChange={(v) => onChange({ ...sel, l3: v, l4: '', inscription: '' })}
          />
        )}
        {sel.l3 && l4Options.length > 0 && (
          <FilterSelect
            label={t('map.filter.l4')}
            value={sel.l4}
            options={l4Options}
            onChange={(v) => onChange({ ...sel, l4: v, inscription: '' })}
          />
        )}

        {showInscriptions && (
          <FilterSelect
            label={t('map.filter.inscription', { count: inscriptionOptions.length })}
            value={sel.inscription}
            options={inscriptionOptions.map((e) => ({
              value: e.zh,
              label: formatInscriptionOptionLabel(e),
            }))}
            onChange={(v) => onChange({ ...sel, inscription: v })}
          />
        )}
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
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
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
