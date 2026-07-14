import Link from 'next/link'
import { DataCard } from '@/components/ui/DataCard'
import { Pagination } from '@/components/ui/Pagination'
import { SearchFilters } from '@/components/search/SearchFilters'
import { SortSelect } from '@/components/search/SortSelect'
import { CoinMapSection } from '@/components/map/CoinMapSection'
import { CoinTypePieChart, type PieGroup } from '@/components/site/CoinTypePieChart'
import { T } from '@/components/i18n/T'
import { TranslatedInput } from '@/components/i18n/TranslatedInput'
import { isUnknownText, countSitesByPrecision, parsePrecisionFilter } from '@/lib/city-boundaries'
import { displayValue, formatNumber, splitCsv } from '@/lib/format'
import { toEnglishName } from '@/lib/name-translation'
import { getAllSites, getCoinTypes, getFindsForHeatmap, searchSites } from '@/lib/queries'
import type { HeatmapFind } from '@/lib/types'
import {
  buildFacetOptions,
  getRegionLabels,
  parseFacetMode,
  parseSortOption,
  siteCoinTypeValues,
  siteMatchesFilters,
  sortSites,
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
    mintMode?: string
    coinType?: string | string[]
    coinTypeMode?: string
    state?: string | string[]
    stateMode?: string
    region?: string | string[]
    period?: string | string[]
    siteType?: string | string[]
    minQty?: string
    maxQty?: string
    onlySingle?: string
    excludeSingle?: string
    sort?: string
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
  const precision = parsePrecisionFilter(params.precision)

  const filters: FilterState = {
    precision,
    mints: toArray(params.mint),
    mintsMode: parseFacetMode(params.mintMode),
    coinTypes: toArray(params.coinType),
    coinTypesMode: parseFacetMode(params.coinTypeMode),
    states: toArray(params.state),
    statesMode: parseFacetMode(params.stateMode),
    regions: toArray(params.region),
    periods: toArray(params.period),
    siteTypes: toArray(params.siteType),
    minQty: params.minQty ? Number(params.minQty) : null,
    maxQty: params.maxQty ? Number(params.maxQty) : null,
    onlySingle: params.onlySingle === '1',
    excludeSingle: params.excludeSingle === '1',
  }
  const sort = parseSortOption(params.sort)

  const currentPage = Math.max(1, Number(params.page) || 1)

  const [baseResults, coinTypes, allFinds] = await Promise.all([
    q ? searchSites(q) : getAllSites(),
    getCoinTypes(),
    getFindsForHeatmap(),
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
  const counts = countSitesByPrecision(precisionScoped)

  const filtered = sortSites(
    baseResults.filter((site) => siteMatchesFilters(site, filters)),
    sort
  )

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

  // Simplified per-site pie data (major coin type only, no inscription
  // breakdown) for the visible page — cheap since it's just an in-memory
  // group-by over the already-fetched finds, scoped to the 20 visible sites.
  const majorTypeByCode = new Map<string, { zh: string; en: string | null }>()
  coinTypes.forEach((c) => {
    if (c.major_type_zh) majorTypeByCode.set(c.coin_type_code, { zh: c.major_type_zh, en: c.major_type_en })
  })
  const visibleCodes = new Set(pageResults.map((s) => s.site_code))
  const findsBySite = new Map<string, HeatmapFind[]>()
  allFinds.forEach((f) => {
    if (!visibleCodes.has(f.site_code)) return
    const list = findsBySite.get(f.site_code) ?? []
    list.push(f)
    findsBySite.set(f.site_code, list)
  })

  function buildSitePie(siteCode: string): PieGroup[] {
    const finds = findsBySite.get(siteCode) ?? []
    const totals = new Map<string, { label: string; labelEn?: string | null; value: number }>()
    finds.forEach((f) => {
      const qty = f.quantity_total ?? f.quantity_estimated ?? f.quantity_min ?? (f.presence ? 1 : null)
      if (qty == null || qty <= 0) return
      const info = f.coin_type_code ? majorTypeByCode.get(f.coin_type_code) : undefined
      const label = info?.zh ?? '未知'
      const existing = totals.get(label)
      if (existing) existing.value += qty
      else totals.set(label, { label, labelEn: info?.en, value: qty })
    })
    return [...totals.values()].map((g) => ({ ...g, children: [] }))
  }

  const precisionTabs: Array<{ id: PrecisionFilter; key: DictionaryKey; count: number }> = [
    { id: 'all', key: 'map.precision.all', count: counts.all },
    { id: 'site', key: 'map.precision.site', count: counts.site },
    { id: 'county', key: 'map.precision.county', count: counts.county },
    { id: 'city', key: 'map.precision.city', count: counts.city },
  ]

  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    filters.mints.forEach((v) => p.append('mint', v))
    if (filters.mintsMode !== 'any') p.set('mintMode', filters.mintsMode)
    filters.coinTypes.forEach((v) => p.append('coinType', v))
    if (filters.coinTypesMode !== 'any') p.set('coinTypeMode', filters.coinTypesMode)
    filters.states.forEach((v) => p.append('state', v))
    if (filters.statesMode !== 'any') p.set('stateMode', filters.statesMode)
    filters.regions.forEach((v) => p.append('region', v))
    filters.periods.forEach((v) => p.append('period', v))
    filters.siteTypes.forEach((v) => p.append('siteType', v))
    if (filters.minQty !== null) p.set('minQty', String(filters.minQty))
    if (filters.maxQty !== null) p.set('maxQty', String(filters.maxQty))
    if (filters.onlySingle) p.set('onlySingle', '1')
    if (filters.excludeSingle) p.set('excludeSingle', '1')
    if (filters.precision !== 'all') p.set('precision', filters.precision)
    if (sort !== 'name') p.set('sort', sort)
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
            className="search-input w-full px-3 py-3 text-sm text-gray-800"
          />
          <button type="submit" className="search-button px-4 py-3 font-semibold">
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
              modes={{
                mints: filters.mintsMode,
                coinTypes: filters.coinTypesMode,
                states: filters.statesMode,
              }}
              minQty={filters.minQty}
              maxQty={filters.maxQty}
              onlySingle={filters.onlySingle}
              excludeSingle={filters.excludeSingle}
            />
          </div>

          <div>
            <div className="panel mb-6 overflow-hidden">
              <CoinMapSection sites={filtered} height="360px" fitBounds />
            </div>

            <div className="mb-3 flex items-center justify-end">
              <SortSelect value={sort} />
            </div>

            <div className="space-y-4">
              {pageResults.map((site) => {
                const nameEn = toEnglishName(site.site_name_zh, site.site_name_en)
                const provinceEn = toEnglishName(site.province_zh, site.province_en)
                const cityEn = toEnglishName(site.city_zh, site.city_en)
                const countyEn = toEnglishName(site.county_zh, site.county_en)
                const pieData = buildSitePie(site.site_code)

                return (
                  <DataCard
                    key={site.site_code}
                    title={
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <Link href={`/sites/${site.site_code}`} className="hover:underline">
                          {displayValue(site.site_name_zh)}
                        </Link>
                        {nameEn && (
                          <span className="text-xs font-normal normal-case italic tracking-normal opacity-70">
                            {nameEn}
                          </span>
                        )}
                        <span className="text-xs font-normal normal-case tracking-normal opacity-50">
                          {site.site_code}
                        </span>
                      </span>
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-[200px] flex-1 space-y-1 text-sm leading-6 text-gray-800">
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
                      {pieData.length > 0 && (
                        <div className="shrink-0">
                          <CoinTypePieChart data={pieData} size={64} showLegend={false} />
                        </div>
                      )}
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
