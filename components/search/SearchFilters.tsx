import type { ReactNode } from 'react'
import { SearchableCheckboxList } from '@/components/search/SearchableCheckboxList'
import { SortSelect } from '@/components/search/SortSelect'
import { T } from '@/components/i18n/T'
import { TranslatedInput } from '@/components/i18n/TranslatedInput'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { FacetMode, FacetOption, SortOption } from '@/lib/search-filters'

const SEARCH_THRESHOLD = 15

type SelectedState = {
  mints: string[]
  coinTypes: string[]
  states: string[]
  regions: string[]
  periods: string[]
  siteTypes: string[]
}

type ModesState = {
  mints: FacetMode
  coinTypes: FacetMode
  states: FacetMode
}

export function SearchFilters({
  mintOptions,
  coinTypeOptions,
  stateOptions,
  regionOptions,
  periodOptions,
  siteTypeOptions,
  selected,
  modes,
  minQty,
  maxQty,
  onlySingle,
  excludeSingle,
  sort,
}: {
  mintOptions: FacetOption[]
  coinTypeOptions: FacetOption[]
  stateOptions: FacetOption[]
  regionOptions: FacetOption[]
  periodOptions: FacetOption[]
  siteTypeOptions: FacetOption[]
  selected: SelectedState
  modes: ModesState
  minQty: number | null
  maxQty: number | null
  onlySingle: boolean
  excludeSingle: boolean
  sort: SortOption
}) {
  return (
    <div className="panel divide-y divide-brand/10">
      <div className="panel-header inline-block px-4 py-2 text-sm font-bold uppercase tracking-wide">
        <T k="filters.panelTitle" />
      </div>

      <div className="p-4">
        <SortSelect value={sort} />
      </div>

      <FacetGroup titleKey="filters.quantity.title">
        <div className="flex items-center gap-2">
          <TranslatedInput
            type="number"
            name="minQty"
            min={0}
            placeholderKey="filters.quantity.min"
            defaultValue={minQty ?? ''}
            className={inputClass}
          />
          <span className="text-gray-400">–</span>
          <TranslatedInput
            type="number"
            name="maxQty"
            min={0}
            placeholderKey="filters.quantity.max"
            defaultValue={maxQty ?? ''}
            className={inputClass}
          />
        </div>
      </FacetGroup>

      <CheckboxFacetGroup titleKey="filters.region.title" name="region" options={regionOptions} selected={selected.regions} />
      <CheckboxFacetGroup titleKey="filters.period.title" name="period" options={periodOptions} selected={selected.periods} />
      <CheckboxFacetGroup
        titleKey="filters.siteType.title"
        name="siteType"
        options={siteTypeOptions}
        selected={selected.siteTypes}
      />
      <CheckboxFacetGroup
        titleKey="filters.coinType.title"
        name="coinType"
        options={coinTypeOptions}
        selected={selected.coinTypes}
        mode={modes.coinTypes}
        modeName="coinTypeMode"
      />
      <CheckboxFacetGroup
        titleKey="filters.state.title"
        name="state"
        options={stateOptions}
        selected={selected.states}
        mode={modes.states}
        modeName="stateMode"
      />
      <CheckboxFacetGroup
        titleKey="filters.mint.title"
        name="mint"
        options={mintOptions}
        selected={selected.mints}
        mode={modes.mints}
        modeName="mintMode"
      />

      <div className="p-4">
        <button
          type="submit"
          className="w-full rounded bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <T k="filters.apply" />
        </button>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded border border-brand/30 px-2 py-1.5 text-sm outline-none focus:border-brand'
const labelClass =
  'flex cursor-pointer items-center gap-2 px-1 py-1 text-sm text-gray-700 hover:bg-brand-light'

function FacetGroup({ titleKey, children }: { titleKey: DictionaryKey; children: ReactNode }) {
  return (
    <details className="p-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
        <T k={titleKey} />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function OptionLabel({ option }: { option: FacetOption }) {
  return (
    <span className="flex-1">
      {option.value}
      {option.en && option.en !== option.value && (
        <span className="ml-1.5 text-xs italic text-gray-400">({option.en})</span>
      )}
    </span>
  )
}

function CheckboxFacetGroup({
  titleKey,
  name,
  options,
  selected,
  mode,
  modeName,
}: {
  titleKey: DictionaryKey
  name: string
  options: FacetOption[]
  selected: string[]
  mode?: FacetMode
  modeName?: string
}) {
  if (options.length === 0) return null

  return (
    <details className="p-4">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
        <T k={titleKey} /> ({options.length})
      </summary>
      <div className="mt-3">
        {mode && modeName && (
          <div className="mb-2 flex items-center gap-3 text-[11px] text-gray-500">
            <span className="font-semibold uppercase tracking-wide">
              <T k="filters.matchMode" />
            </span>
            <label className="flex items-center gap-1 normal-case">
              <input
                type="radio"
                name={modeName}
                value="any"
                defaultChecked={mode !== 'all'}
                className="accent-brand"
              />
              <T k="filters.mode.any" />
            </label>
            <label className="flex items-center gap-1 normal-case">
              <input
                type="radio"
                name={modeName}
                value="all"
                defaultChecked={mode === 'all'}
                className="accent-brand"
              />
              <T k="filters.mode.all" />
            </label>
          </div>
        )}
        {options.length > SEARCH_THRESHOLD ? (
          <SearchableCheckboxList name={name} options={options} selected={selected} />
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {options.map((opt) => (
              <label key={opt.value} className={labelClass}>
                <input
                  type="checkbox"
                  name={name}
                  value={opt.value}
                  defaultChecked={selected.includes(opt.value)}
                  className="accent-brand"
                />
                <OptionLabel option={opt} />
                <span className="text-xs text-gray-400">({opt.count})</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}
