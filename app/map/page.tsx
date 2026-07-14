import Link from 'next/link'
import { FindSpotsMap } from '@/components/map/FindSpotsMap'
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
  title: 'Find Spots | Early Chinese Coin Finds',
  description:
    'Interactive map of georeferenced coin find sites with typology-based coin type filtering.',
}

export default async function MapPage({ searchParams }: PageProps) {
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
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="shrink-0 border-b border-brand/20 bg-white px-4 py-3">
        <h1 className="font-serif text-xl font-semibold text-brand">
          <T k="map.title" />
        </h1>
        <p className="text-sm text-gray-600">
          <T k="map.count" vars={{ count: sites.length }} />
        </p>
        <div className="mt-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <T k="map.precision.label" />
          </p>
          <div className="flex flex-wrap gap-2">
            {PRECISION_TABS.map((tab) => {
              const active = tab.id === currentPrecision
              const href = `/map${tab.id === 'all' ? '' : `?precision=${tab.id}`}`
              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={`rounded border px-3 py-1 text-xs transition ${
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
      </div>
      <FindSpotsMap sites={sites} coinTypes={coinTypes} finds={finds} />
    </div>
  )
}
