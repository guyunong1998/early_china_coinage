import Link from 'next/link'
import { CoinTypeListClient } from '@/components/coin-types/CoinTypeListClient'
import { MapVisCanvas } from '@/components/map/MapVisCanvas'
import { T } from '@/components/i18n/T'
import { COIN_TYPE_NODES, computeAllCoinTypeCounts } from '@/lib/coin-type-catalog'
import { getCoinTypes, getFindSpotsMapSites, getFindsForHeatmap } from '@/lib/queries'

export const metadata = {
  title: 'Coin Types | Early Chinese Coin Finds',
  description: 'Every documented coin type, grouped by the typology hierarchy, with find-site counts.',
}

export default async function CoinTypesPage() {
  const [sites, coinTypes, finds] = await Promise.all([
    getFindSpotsMapSites(),
    getCoinTypes(),
    getFindsForHeatmap(),
  ])

  const countsBySlug = computeAllCoinTypeCounts(finds, coinTypes)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="nav.coinTypes" />
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {COIN_TYPE_NODES.length} coin types documented, grouped by the typology hierarchy.
        </p>
      </div>

      {/* Overview map — same left-third title/link + right-two-thirds map
          card the home page uses for its own map section. Links to the Find
          Site visualization, which defaults to its "filter by coin type"
          mode, so the destination matches this page's own subject. */}
      <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
        <div className="flex flex-col justify-center gap-3 p-6 lg:col-span-1">
          <h2 className="font-serif text-xl font-semibold text-brand">
            <T k="navcards.map.label" />
          </h2>
          <p className="text-sm leading-6 text-gray-600">
            <T k="navcards.map.desc" />
          </p>
          <Link
            href="/visualizations/find-site"
            className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
          >
            <T k="home.mapSection.title" /> →
          </Link>
        </div>
        <div className="lg:col-span-2 p-4">
          <div className="relative overflow-hidden" style={{ height: '340px', width: '100%' }}>
            <MapVisCanvas
              kind="sites"
              sites={sites}
              mode="type"
              siteStates={null}
              viewMode="points"
              densityLatLngs={[]}
              filterActive={false}
              fullControls={false}
              height="340px"
            />
          </div>
        </div>
      </div>

      {/* Searchable list */}
      <div className="mt-8">
        <CoinTypeListClient nodes={COIN_TYPE_NODES} countsBySlug={countsBySlug} />
      </div>
    </div>
  )
}
