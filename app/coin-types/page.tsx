import Image from 'next/image'
import Link from 'next/link'
import { CoinTypeListClient } from '@/components/coin-types/CoinTypeListClient'
import { FullTypologyTree } from '@/components/coin-types/TypologyTree'
import { TypologyViewer } from '@/components/coin-types/TypologyViewer'
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

// Same "spade, knife & round coins compared" demo the homepage carousel
// leads with — its screenshot doubles as this page's map preview since the
// subject matches (a coin-type Compare view), rather than rendering a
// second live map just to sit unfiltered.
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

      {/* Overview row — left half is the map (title/links + the same
          static Compare-view screenshot the home page uses, since its
          subject already matches this page's), right half is the full
          typology hierarchy tree, so the two most-used ways into the data
          (by map, by type) sit side by side above the fold. */}
      <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-2">
        <div className="flex flex-col gap-3 p-4">
          <div className="panel-nav-card-inner flex flex-col gap-2 p-4">
            <h2 className="font-serif text-xl font-semibold text-brand">
              <T k="navcards.map.label" />
            </h2>
            <p className="text-sm leading-6 text-gray-600">
              <T k="navcards.map.desc" />
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/visualizations"
                className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
              >
                <T k="home.mapSection.title" /> →
              </Link>
            </div>
          </div>
          <Link
            href={demoHref(OVERVIEW_DEMO)}
            className="group relative block aspect-video w-full overflow-hidden rounded border border-brand/15 bg-gray-100"
          >
            <Image
              src={OVERVIEW_DEMO.image}
              alt={`${OVERVIEW_DEMO.title.zh} (${OVERVIEW_DEMO.title.en})`}
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </Link>
        </div>

        {/* Full typology hierarchy — both level1 roots (钱币 Coin, 钱范
            Mould) down through every descendant, so the whole classification
            system (every one of the {cardNodes.length} types below) is
            browsable as one tree, not just the single-branch view the
            detail page shows. Fixed at 460px (internally scrollable past
            that) rather than growing to fit a fully-expanded tree, since
            this sits beside the map card. */}
        <div className="p-4 flex flex-col border-t border-brand/15 lg:border-l lg:border-t-0">
          <div className="panel-header px-4 py-3 text-sm font-bold uppercase tracking-wide">
            <T k="coinTypeDetail.hierarchy" />
          </div>
          <div className="scrollbar min-h-[460px] overflow-y-auto p-5 pl-8 lg:max-h-[460px] lg:flex-1">
            <FullTypologyTree nodes={nodes} />
          </div>
        </div>
      </div>

      {/* Typology Viewer — the same hierarchy as a single pannable/zoomable
          poster image (photos + silhouettes + connecting lines baked in by
          scripts/gen-coin-hierarchy-diagram.py), for browsing the whole
          classification visually instead of as text. */}
      <section className="panel mt-8 overflow-hidden">
        <div className="panel-header px-4 py-3 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeList.typologyViewer.title" />
        </div>
        <div className="p-5">
          <TypologyViewer src="/images/coin-type-hierarchy.png" manifest={typologyManifest} />
        </div>
      </section>

      {/* Searchable list */}
      <div className="mt-8">
        <CoinTypeListClient nodes={cardNodes} countsBySlug={countsBySlug} imagesBySlug={imagesBySlug} />
      </div>
    </div>
  )
}
