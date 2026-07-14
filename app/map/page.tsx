import Link from 'next/link'
import { CoinMapSection } from '@/components/map/CoinMapSection'
import { getSitePrecision, isUnknownText } from '@/lib/city-boundaries'
import { getMapSites } from '@/lib/queries'

type PrecisionFilter = 'all' | 'city' | 'city_only' | 'county_only'

type PageProps = {
  searchParams: Promise<{ precision?: string }>
}

export default async function MapPage({ searchParams }: PageProps) {
  const { precision = 'all' } = await searchParams
  const currentPrecision: PrecisionFilter =
    precision === 'city' || precision === 'city_only' || precision === 'county_only'
      ? precision
      : 'all'

  const allSites = await getMapSites()
  const counts = {
    all: allSites.length,
    city: allSites.filter((site) => !isUnknownText(site.city_zh)).length,
    city_only: allSites.filter((site) => getSitePrecision(site) === 'city_only').length,
    county_only: allSites.filter((site) => getSitePrecision(site) === 'county_only').length,
  }

  const sites =
    currentPrecision === 'all'
      ? allSites
      : allSites.filter((site) => {
          if (currentPrecision === 'city') return !isUnknownText(site.city_zh)
          return getSitePrecision(site) === currentPrecision
        })

  const precisionTabs: Array<{ id: PrecisionFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'city', label: 'City', count: counts.city },
    { id: 'city_only', label: 'Only know city', count: counts.city_only },
    { id: 'county_only', label: 'Only know county', count: counts.county_only },
  ]

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="border-b border-brand/20 bg-white px-4 py-3">
        <h1 className="font-serif text-xl font-semibold text-brand">Find Spots</h1>
        <p className="text-sm text-gray-600">{sites.length} georeferenced sites</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {precisionTabs.map((tab) => {
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
                {tab.label} ({tab.count})
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex-1">
        <CoinMapSection sites={sites} height="100%" />
      </div>
    </div>
  )
}
