import Link from 'next/link'
import { DataCard } from '@/components/ui/DataCard'
import { SearchForm } from '@/components/ui/SearchForm'
import { getSitePrecision, isUnknownText } from '@/lib/city-boundaries'
import { displayValue, formatLocation, formatNumber } from '@/lib/format'
import { searchSites } from '@/lib/queries'

type PageProps = {
  searchParams: Promise<{ q?: string; precision?: string }>
}

type PrecisionFilter = 'all' | 'city' | 'city_only' | 'county_only'

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = '', precision = 'all' } = await searchParams
  const currentPrecision: PrecisionFilter =
    precision === 'city' || precision === 'city_only' || precision === 'county_only'
      ? precision
      : 'all'

  const rawResults = q ? await searchSites(q) : []
  const counts = {
    all: rawResults.length,
    city: rawResults.filter((site) => !isUnknownText(site.city_zh)).length,
    city_only: rawResults.filter((site) => getSitePrecision(site) === 'city_only').length,
    county_only: rawResults.filter((site) => getSitePrecision(site) === 'county_only').length,
  }

  const results =
    currentPrecision === 'all'
      ? rawResults
      : rawResults.filter((site) => {
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold text-brand">Search</h1>
        <p className="mt-2 text-sm text-gray-600">
          Search sites by name, province, coin type, inscription, or site code.
        </p>
        <div className="mt-4">
          <SearchForm defaultValue={q} />
        </div>
      </div>

      {q && (
        <p className="mb-4 text-sm text-gray-600">
          {results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{q}&rdquo;
          {currentPrecision !== 'all' && (
            <span className="ml-2 text-gray-500">({precisionTabs.find((p) => p.id === currentPrecision)?.label})</span>
          )}
        </p>
      )}

      {q && (
        <div className="mb-5 flex flex-wrap gap-2">
          {precisionTabs.map((tab) => {
            const active = tab.id === currentPrecision
            const href = `/search?q=${encodeURIComponent(q)}${
              tab.id === 'all' ? '' : `&precision=${tab.id}`
            }`
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
                {tab.label} ({tab.count})
              </Link>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        {results.map((site) => (
          <DataCard key={site.site_code} title={site.site_code}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  <Link href={`/sites/${site.site_code}`} className="hover:text-brand">
                    {displayValue(site.site_name_zh)}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-gray-600">{formatLocation(site)}</p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Types:</span> {displayValue(site.major_types_zh)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Inscriptions:</span>{' '}
                  {displayValue(site.inscriptions)}
                </p>
              </div>
              <div className="text-sm text-gray-700">
                <p>{formatNumber(site.total_quantity_for_map)} coins</p>
                <Link
                  href={`/sites/${site.site_code}`}
                  className="mt-2 inline-block text-brand hover:underline"
                >
                  View record →
                </Link>
              </div>
            </div>
          </DataCard>
        ))}
      </div>
    </div>
  )
}
