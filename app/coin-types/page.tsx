import Image from 'next/image'
import Link from 'next/link'
import { CoinTypeListClient } from '@/components/coin-types/CoinTypeListClient'
import { TypologyHierarchyCard } from '@/components/coin-types/TypologyHierarchyCard'
import { MapOverviewCard } from '@/components/home/MapOverviewCard'
import { T } from '@/components/i18n/T'
import { buildCoinTypeNodes, computeAllCoinTypeCounts } from '@/lib/coin-type-catalog'
import { getCoinTypeImagePaths, type CoinTypeImagePaths } from '@/lib/coin-images'
import { DEMO_VISUALIZATIONS, demoHref } from '@/lib/demo-visualizations'
import { getCoinIssues, getCoinTypeHierarchy, getFindsForHeatmap } from '@/lib/queries'
import { loadTypologyManifest } from '@/lib/typology-manifest'

export const metadata = {
  title: 'Coin Types | Early Chinese Coin Finds',
  description: 'Every documented coin type, grouped by the typology hierarchy, with find-site counts.',
}

// Same "spade, knife, round & ant-nose coins compared" demo the homepage
// carousel leads with — its screenshot doubles as this page's map preview
// since the subject matches (a coin-type Compare view), rather than
// rendering a second live map just to sit unfiltered.
const OVERVIEW_DEMO = DEMO_VISUALIZATIONS.find((d) => d.id === 'spade-knife-round-compare')!

export default async function CoinTypesPage() {
  const [coinIssues, hierarchyRows, finds] = await Promise.all([
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
  ])

  const typologyManifest = loadTypologyManifest()
  const nodes = buildCoinTypeNodes(hierarchyRows, coinIssues)
  const countsBySlug = computeAllCoinTypeCounts(nodes, finds, coinIssues)
  // level1 (钱币 / 钱范) is a matching/grouping concept, not a browsable
  // card — the listing starts at level2.
  const cardNodes = nodes.filter((n) => n.level !== 'level1')
  const imagesBySlug: Record<string, CoinTypeImagePaths> = {}
  cardNodes.forEach((n) => {
    imagesBySlug[n.slug] = getCoinTypeImagePaths(n.imgAccNum, n.slug)
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="nav.coinTypes" />
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {cardNodes.length} coin types documented, grouped by the typology hierarchy.
        </p>
      </div>

      {/* Reuses OVERVIEW_DEMO's static (pre-cropped, 16:9) screenshot rather
          than a second live map, since its subject (a coin-type Compare
          view) already matches this page's. */}
      <MapOverviewCard href="/visualizations">
        <Link
          href={demoHref(OVERVIEW_DEMO)}
          className="group relative block aspect-video w-full overflow-hidden rounded border border-brand/15 bg-gray-100"
        >
          <Image
            src={OVERVIEW_DEMO.image}
            alt={`${OVERVIEW_DEMO.title.zh} (${OVERVIEW_DEMO.title.en})`}
            fill
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        </Link>
      </MapOverviewCard>

      {/* Typology Hierarchy — both level1 roots (钱币 Coin, 钱范 Mould) down
          through every descendant, browsable either as the pannable/zoomable
          poster diagram (photos + silhouettes + connecting lines baked in by
          scripts/gen-coin-hierarchy-diagram.py) or as a plain nested tree —
          same {cardNodes.length}-type hierarchy, one card, a toggle between
          the two views. */}
      <TypologyHierarchyCard nodes={nodes} src="/images/coin-type-hierarchy.png" manifest={typologyManifest} />

      {/* Searchable list */}
      <div className="mt-8">
        <CoinTypeListClient nodes={cardNodes} countsBySlug={countsBySlug} imagesBySlug={imagesBySlug} />
      </div>
    </div>
  )
}
