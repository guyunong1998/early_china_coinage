import Image from 'next/image'
import Link from 'next/link'
import { CoinTypeListClient } from '@/components/coin-types/CoinTypeListClient'
import { FullTypologyTree } from '@/components/coin-types/TypologyTree'
import { T } from '@/components/i18n/T'
import { buildCoinTypeNodes, computeAllCoinTypeCounts } from '@/lib/coin-type-catalog'
import { getCoinTypeImagePaths, type CoinTypeImagePaths } from '@/lib/coin-images'
import { DEMO_VISUALIZATIONS, demoHref } from '@/lib/demo-visualizations'
import { getCoinIssues, getCoinTypeHierarchy, getFindsForHeatmap } from '@/lib/queries'

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

      {/* Overview map — same left-third title/link + right-two-thirds
          preview card the home page uses for its own map section, reusing
          that same demo's static (pre-cropped, 16:9) screenshot rather than
          a second live map, since its subject (a coin-type Compare view)
          already matches this page's. Links to the same pre-built URL. */}
      <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
        <div className="panel-nav-card-inner m-4 flex flex-col justify-center gap-0 p-4 lg:col-span-1">
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
        </div>
      </div>

      {/* Full typology hierarchy — both level1 roots (钱币 Coin, 钱范 Mould)
          down through every descendant, so the whole classification system
          (every one of the {cardNodes.length} types below) is browsable as
          one tree, not just the single-branch view the detail page shows. */}
      <section className="panel mt-8 overflow-hidden">
        <div className="panel-header px-4 py-3 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeDetail.hierarchy" />
        </div>
        <div className="p-5 pl-8">
          <FullTypologyTree nodes={nodes} />
        </div>
      </section>

      {/* Searchable list */}
      <div className="mt-8">
        <CoinTypeListClient nodes={cardNodes} countsBySlug={countsBySlug} imagesBySlug={imagesBySlug} />
      </div>
    </div>
  )
}
