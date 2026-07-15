import Link from 'next/link'
import { FindSpotsVisualization } from '@/components/visualizations/FindSpotsVisualization'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import {
  countSitesByPrecision,
  parsePrecisionFilter,
  siteMatchesPrecisionFilter,
  type PrecisionFilter,
} from '@/lib/city-boundaries'
import { getCoinTypes, getFindSpotsMapSites, getFindsForHeatmap } from '@/lib/queries'

const PRECISION_TABS: Array<{ id: PrecisionFilter; key: DictionaryKey }> = [
  { id: 'all', key: 'map.precision.all' },
  { id: 'site', key: 'map.precision.site' },
  { id: 'county', key: 'map.precision.county' },
  { id: 'city', key: 'map.precision.city' },
]

type PageProps = {
  searchParams: Promise<{ precision?: string }>
}

export const metadata = {
  title: 'Mint Visualization | Early Chinese Coin Finds',
  description: 'Interactive map of georeferenced coin find sites with mint-based filtering.',
}

export default async function MintVisualizationPage({ searchParams }: PageProps) {
  const { precision: precisionParam } = await searchParams
  const currentPrecision = parsePrecisionFilter(precisionParam)

  const [allSites, coinTypes, finds] = await Promise.all([
    getFindSpotsMapSites(),
    getCoinTypes(),
    getFindsForHeatmap(),
  ])

  const counts = countSitesByPrecision(allSites)
  const sites = allSites.filter((site) => siteMatchesPrecisionFilter(site, currentPrecision))

  return (
    <div className="flex flex-col min-[1440px]:h-[calc(100dvh-4.5rem)] min-[1440px]:overflow-hidden">
      <div className="shrink-0 border-b border-brand/20 bg-white px-3 py-2 sm:px-4">
        <h1 className="font-serif text-lg font-semibold text-brand">
          <T k="nav.map" />
        </h1>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-brand/20 bg-white px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="font-serif text-base font-semibold text-brand sm:text-lg">
            <T k="map.title" />
          </h2>
          <p className="truncate text-xs text-gray-500">
            <T k="map.count" vars={{ count: sites.length }} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <T k="map.precision.label" />
          </span>
          {PRECISION_TABS.map((tab) => {
            const active = tab.id === currentPrecision
            const href = `/visualizations/mint${tab.id === 'all' ? '' : `?precision=${tab.id}`}`
            return (
              <Link
                key={tab.id}
                href={href}
                className={`rounded border px-2 py-0.5 text-[11px] transition sm:px-2.5 sm:text-xs ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-brand/30 bg-white text-brand hover:bg-brand-light'
                }`}
              >
                <T k={tab.key} /> ({counts[tab.id]})
              </Link>
            )
          })}
        </div>
      </div>
      <FindSpotsVisualization sites={sites} coinTypes={coinTypes} finds={finds} forcedMode="mint" />
    </div>
  )
}
