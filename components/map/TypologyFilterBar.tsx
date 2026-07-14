'use client'

import { T } from '@/components/i18n/T'
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

  const hasFilter = !!sel.l1
  // Show inscriptions at any typology leaf — including L1-only categories
  // like Round Coin (圜钱) that have no L2/L3 children.
  const showInscriptions =
    showInscriptionList &&
    inscriptionOptions.length > 0 &&
    isTypologyLeafSelection(sel)

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={sel.l1}
          placeholder={t('map.filter.l1')}
          options={l1Options}
          onChange={(v) => onChange({ ...emptyTypologySelection(), l1: v })}
        />
        {sel.l1 && l2Options.length > 0 && (
          <FilterSelect
            value={sel.l2}
            placeholder={t('map.filter.l2')}
            options={l2Options}
            onChange={(v) => onChange({ ...sel, l2: v, l3: '', l4: '', inscription: '' })}
          />
        )}
        {sel.l2 && l3Options.length > 0 && (
          <FilterSelect
            value={sel.l3}
            placeholder={t('map.filter.l3')}
            options={l3Options}
            onChange={(v) => onChange({ ...sel, l3: v, l4: '', inscription: '' })}
          />
        )}
        {sel.l3 && l4Options.length > 0 && (
          <FilterSelect
            value={sel.l4}
            placeholder={t('map.filter.l4')}
            options={l4Options}
            onChange={(v) => onChange({ ...sel, l4: v, inscription: '' })}
          />
        )}
        {hasFilter && (
          <button
            type="button"
            onClick={() => onChange(emptyTypologySelection())}
            className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-brand border border-gray-200 hover:border-brand"
          >
            <T k="heatmap.clearFilter" />
          </button>
        )}
      </div>

      {showInscriptions && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <T k="map.filter.inscription" vars={{ count: inscriptionOptions.length }} />
            {sel.inscription && (
              <button
                type="button"
                onClick={() => onChange({ ...sel, inscription: '' })}
                className="ml-2 normal-case font-normal text-gray-400 hover:text-brand"
              >
                <T k="coinFilterMap.clear" />
              </button>
            )}
          </p>
          <div
            className={`overflow-y-auto border border-brand/20 bg-white ${
              compact ? 'max-h-28' : 'max-h-36'
            }`}
          >
            {inscriptionOptions.map((e) => (
              <button
                key={e.zh}
                type="button"
                onClick={() =>
                  onChange({ ...sel, inscription: sel.inscription === e.zh ? '' : e.zh })
                }
                className={`flex w-full items-baseline gap-3 px-3 py-1.5 text-left text-sm transition hover:bg-brand-light ${
                  sel.inscription === e.zh ? 'bg-brand text-white hover:bg-brand' : ''
                }`}
              >
                <span
                  className={`w-20 shrink-0 font-semibold ${sel.inscription === e.zh ? 'text-white' : 'text-gray-800'}`}
                >
                  {e.zh}
                </span>
                <span className={`flex-1 ${sel.inscription === e.zh ? 'text-white/90' : 'text-gray-500'}`}>
                  {e.en}
                </span>
                {e.mint_zh && (
                  <span
                    className={`shrink-0 text-xs ${sel.inscription === e.zh ? 'text-white/70' : 'text-brand/60'}`}
                  >
                    <T k="coinFilterMap.mintLabel" /> {e.mint_zh}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
