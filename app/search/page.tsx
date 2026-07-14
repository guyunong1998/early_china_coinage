import Link from 'next/link'
import { DataCard } from '@/components/ui/DataCard'
import { Pagination } from '@/components/ui/Pagination'
import { SearchFilters } from '@/components/search/SearchFilters'
import { CoinMapSection } from '@/components/map/CoinMapSection'
import { T } from '@/components/i18n/T'
import { TranslatedInput } from '@/components/i18n/TranslatedInput'
import { isUnknownText, getSitePrecision } from '@/lib/city-boundaries'
import { displayValue, formatNumber, splitCsv } from '@/lib/format'
import { toEnglishName } from '@/lib/name-translation'
import { getAllSites, getCoinTypes, searchSites } from '@/lib/queries'
import {
  buildFacetOptions,
  getRegionLabels,
  siteCoinTypeValues,
  siteMatchesFilters,
  withEnglish,
  type FilterState,
  type PrecisionFilter,
} from '@/lib/search-filters'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

const PAGE_SIZE = 20

// Same glossary/format used by the map popups (CoinMap.tsx, CoinFilterMap.tsx,
// CoinTypeHeatmapMap.tsx) so the result list matches what clicking a dot shows.
const COIN_TYPE_TRANSLATIONS: Record<string, string> = {
  布币: 'Spade Coin',
  刀币: 'Knife-Shaped Coin',
  圜钱: 'Round Coin',
  蚁鼻钱: 'Cowrie Coin',
  金版: 'Gold Plate',
}

function formatCoinTypeBilingual(value: string | null | undefined) {
  if (!value) return '—'
  return value
    .split(/[、,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((zh) => {
      const en = COIN_TYPE_TRANSLATIONS[zh]
      return en ? `${zh} (${en})` : zh
    })
    .join('、')
}

type PageProps = {
  searchParams: Promise<{
    q?: string
    precision?: string
    mint?: string | string[]
    coinType?: string | string[]
    state?: string | string[]
    region?: string | string[]
    period?: string | string[]
    siteType?: string | string[]
    minQty?: string
    maxQty?: string
    onlySingle?: string
    excludeSingle?: string
    page?: string
  }>
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const q = params.q ?? ''
  const precisionParam = params.precision ?? 'all'
  const precision: PrecisionFilter =
    precisionParam === 'city' || precisionParam === 'city_only' || precisionParam === 'county_only'
      ? precisionParam
      : 'all'

  const filters: FilterState = {
    precision,
    mints: toArray(params.mint),
    coinTypes: toArray(params.coinType),
    states: toArray(params.state),
    regions: toArray(params.region),
    periods: toArray(params.period),
    siteTypes: toArray(params.siteType),
    minQty: params.minQty ? Number(params.minQty) : null,
    maxQty: params.maxQty ? Number(params.maxQty) : null,
    onlySingle: params.onlySingle === '1',
    excludeSingle: params.excludeSingle === '1',
  }

  const currentPage = Math.max(1, Number(params.page) || 1)

  const [baseResults, coinTypes] = await Promise.all([
    q ? searchSites(q) : getAllSites(),
    getCoinTypes(),
  ])

  // English lookups so filter items can show both languages regardless of
  // the UI language toggle (which only affects labels/buttons/descriptions).
  const mintEnByZh = new Map<string, string>()
  const coinTypeEnByZh = new Map<string, string>()
  const stateEnByZh = new Map<string, string>()
  coinTypes.forEach((c) => {
    if (c.mint_zh && c.mint_en) mintEnByZh.set(c.mint_zh, c.mint_en)
    if (c.major_type_zh && c.major_type_en) coinTypeEnByZh.set(c.major_type_zh, c.major_type_en)
    if (c.minor_type_zh && c.minor_type_en) coinTypeEnByZh.set(c.minor_type_zh, c.minor_type_en)
    if (c.inscription && c.inscription_en) coinTypeEnByZh.set(c.inscription, c.inscription_en)
    if (c.state_zh && c.state_en) stateEnByZh.set(c.state_zh, c.state_en)
  })

  const periodEnByZh = new Map<string, string>()
  const siteTypeEnByZh = new Map<string, string>()
  const regionEnByLabel = new Map<string, string>()
  baseResults.forEach((site) => {
    if (site.period_zh && site.period_en) periodEnByZh.set(site.period_zh, site.period_en)
    if (site.site_type_zh && site.site_type_en) siteTypeEnByZh.set(site.site_type_zh, site.site_type_en)
    if (!isUnknownText(site.province_zh)) {
      if (site.province_en) regionEnByLabel.set(site.province_zh as string, site.province_en)
      if (!isUnknownText(site.city_zh)) {
        const zhLabel = `${site.province_zh} · ${site.city_zh}`
        const enParts = [site.province_en, site.city_en].filter(Boolean)
        if (enParts.length > 0) regionEnByLabel.set(zhLabel, enParts.join(' · '))
      }
    }
  })

  const precisionScoped = baseResults.filter((site) => siteMatchesFilters(site, filters, 'precision'))
  const counts = {
    all: precisionScoped.length,
    city: precisionScoped.filter((site) => !isUnknownText(site.city_zh)).length,
    city_only: precisionScoped.filter((site) => getSitePrecision(site) === 'city_only').length,
    county_only: precisionScoped.filter((site) => getSitePrecision(site) === 'county_only').length,
  }

  const filtered = baseResults.filter((site) => siteMatchesFilters(site, filters))

  const mintOptions = withEnglish(
    buildFacetOptions(baseResults, filters, 'mint', (s) => splitCsv(s.mints_zh), filters.mints),
    mintEnByZh
  )
  const coinTypeOptions = withEnglish(
    buildFacetOptions(baseResults, filters, 'coinType', siteCoinTypeValues, filters.coinTypes),
    coinTypeEnByZh
  )
  const stateOptions = withEnglish(
    buildFacetOptions(baseResults, filters, 'state', (s) => splitCsv(s.states_zh), filters.states),
    stateEnByZh
  )
  const regionOptions = withEnglish(
    buildFacetOptions(baseResults, filters, 'region', getRegionLabels, filters.regions),
    regionEnByLabel
  )
  const periodOptions = withEnglish(
    buildFacetOptions(baseResults, filters, 'period', (s) => (s.period_zh ? [s.period_zh] : []), filters.periods),
    periodEnByZh
  )
  const siteTypeOptions = withEnglish(
    buildFacetOptions(
      baseResults,
      filters,
      'siteType',
      (s) => (s.site_type_zh ? [s.site_type_zh] : []),
      filters.siteTypes
    ),
    siteTypeEnByZh
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const pageResults = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const precisionTabs: Array<{ id: PrecisionFilter; key: DictionaryKey; count: number }> = [
    { id: 'all', key: 'search.precision.all', count: counts.all },
    { id: 'city', key: 'search.precision.city', count: counts.city },
    { id: 'city_only', key: 'search.precision.cityOnly', count: counts.city_only },
    { id: 'county_only', key: 'search.precision.countyOnly', count: counts.county_only },
  ]

  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    filters.mints.forEach((v) => p.append('mint', v))
    filters.coinTypes.forEach((v) => p.append('coinType', v))
    filters.states.forEach((v) => p.append('state', v))
    filters.regions.forEach((v) => p.append('region', v))
    filters.periods.forEach((v) => p.append('period', v))
    filters.siteTypes.forEach((v) => p.append('siteType', v))
    if (filters.minQty !== null) p.set('minQty', String(filters.minQty))
    if (filters.maxQty !== null) p.set('maxQty', String(filters.maxQty))
    if (filters.onlySingle) p.set('onlySingle', '1')
    if (filters.excludeSingle) p.set('excludeSingle', '1')
    if (filters.precision !== 'all') p.set('precision', filters.precision)
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) p.delete(key)
      else p.set(key, value)
    })
    return `/search?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="search.title" />{' '}
          <span className="text-2xl font-normal text-gray-500">
            (
            <T
              k={filtered.length === 1 ? 'search.resultCountOne' : 'search.resultCount'}
              vars={{ count: filtered.length }}
            />
            )
          </span>
        </h1>
        {q && (
          <p className="mt-1 text-sm text-gray-600">
            <T k="search.resultCountFor" vars={{ query: q }} />
          </p>
        )}
      </div>

      <form action="/search" method="get">
        <input type="hidden" name="precision" value={filters.precision !== 'all' ? filters.precision : ''} />

        <div className="mx-auto mb-4 flex w-full max-w-3xl gap-0">
          <TranslatedInput
            type="search"
            name="q"
            defaultValue={q}
            placeholderKey="search.placeholder"
            className="w-full rounded-l border border-brand/30 bg-white px-3 py-3 text-sm text-gray-800 outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-r bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark"
          >
            →
          </button>
        </div>

        <div className="mx-auto mb-5 flex max-w-3xl flex-wrap gap-2">
          {precisionTabs.map((tab) => {
            const active = tab.id === precision
            const href = buildHref({ precision: tab.id === 'all' ? undefined : tab.id })
            return (
              <Link
                key={tab.id}
                href={href}
                className={`rounded border px-3 py-1.5 text-sm transition ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-brand/30 bg-white text-brand hover:bg-brand-light'
                }`}
              >
                <T k={tab.key} /> ({tab.count})
              </Link>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <SearchFilters
              mintOptions={mintOptions}
              coinTypeOptions={coinTypeOptions}
              stateOptions={stateOptions}
              regionOptions={regionOptions}
              periodOptions={periodOptions}
              siteTypeOptions={siteTypeOptions}
              selected={{
                mints: filters.mints,
                coinTypes: filters.coinTypes,
                states: filters.states,
                regions: filters.regions,
                periods: filters.periods,
                siteTypes: filters.siteTypes,
              }}
              minQty={filters.minQty}
              maxQty={filters.maxQty}
              onlySingle={filters.onlySingle}
              excludeSingle={filters.excludeSingle}
            />
          </div>

          <div>
            <div className="mb-6 overflow-hidden border border-brand/20">
              <CoinMapSection sites={filtered} height="360px" fitBounds />
            </div>

            <div className="space-y-4">
              {pageResults.map((site) => {
                const nameEn = toEnglishName(site.site_name_zh, site.site_name_en)
                const provinceEn = toEnglishName(site.province_zh, site.province_en)
                const cityEn = toEnglishName(site.city_zh, site.city_en)
                const countyEn = toEnglishName(site.county_zh, site.county_en)

                return (
                  <DataCard key={site.site_code} title={site.site_code}>
                    <div className="space-y-1 text-sm leading-6 text-gray-800">
                      <p>
                        <span className="font-semibold">Site name / 遗址：</span>
                        <Link href={`/sites/${site.site_code}`} className="text-brand hover:underline">
                          {displayValue(site.site_name_zh)}
                        </Link>
                        {nameEn && <span className="ml-2 italic text-gray-400">{nameEn}</span>}
                      </p>
                      <p>
                        <span className="font-semibold">Province / 省：</span>
                        {displayValue(site.province_zh)}
                        {provinceEn && <span className="text-gray-400"> ({provinceEn})</span>}
                      </p>
                      <p>
                        <span className="font-semibold">City / 市：</span>
                        {displayValue(site.city_zh)}
                        {cityEn && <span className="text-gray-400"> ({cityEn})</span>}
                      </p>
                      <p>
                        <span className="font-semibold">County / 县：</span>
                        {displayValue(site.county_zh)}
                        {countyEn && <span className="text-gray-400"> ({countyEn})</span>}
                      </p>
                      <p>
                        <span className="font-semibold">Coin type / 币类：</span>
                        {formatCoinTypeBilingual(site.major_types_zh)}
                      </p>
                      <p>
                        <span className="font-semibold">Quantity / 数量：</span>
                        {formatNumber(site.total_quantity_for_map)}
                      </p>
                    </div>
                    <Link
                      href={`/sites/${site.site_code}`}
                      className="mt-2 inline-block text-sm text-brand hover:underline"
                    >
                      <T k="search.viewRecord" />
                    </Link>
                  </DataCard>
                )
              })}

              {pageResults.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500">
                  <T k="search.noResults" />
                </p>
              )}
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              buildHref={(p) => buildHref({ page: p === 1 ? undefined : String(p) })}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
