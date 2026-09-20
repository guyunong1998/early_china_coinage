import Link from 'next/link'
import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { DemoVisualizationsCarousel } from '@/components/home/DemoVisualizationsCarousel'
import { Level2TypeShowcase } from '@/components/home/Level2TypeShowcase'
import { T } from '@/components/i18n/T'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import { buildCoinTypeNodes, pickLevel2ShowcasePhotos } from '@/lib/coin-type-catalog'
import { getCoinIssues, getCoinTypeHierarchy } from '@/lib/queries'

export const revalidate = 86400

export default async function Home() {
  const [hierarchyRows, coinIssues] = await Promise.all([getCoinTypeHierarchy(), getCoinIssues()])
  const nodes = buildCoinTypeNodes(hierarchyRows, coinIssues)
  const showcaseItems = pickLevel2ShowcasePhotos(nodes, hierarchyRows, (accNum) => getCoinTypeImagePaths(accNum).obverseSrc)

  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <NavCards />
        </div>
        <DemoVisualizationsCarousel />

        {/* Coin types teaser — same left/right split as the Map
            Visualizations section above, just with the preview as the
            larger two-thirds since it's the whole point here. Each side is
            its own bordered box rather than sharing one outer frame,
            matching the Map Visualizations split above. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="panel-nav-card overflow-hidden p-4 lg:col-span-2">
            <Level2TypeShowcase items={showcaseItems} />
          </div>
          <div className="panel-nav-card flex flex-col p-3 lg:col-span-1">
            <div className="panel-nav-card-inner flex flex-1 flex-col justify-center gap-0 p-4">
              <h2 className="font-serif text-xl font-semibold text-brand">
                <T k="nav.coinTypes" />
              </h2>
              <p className="text-sm leading-6 text-gray-600">
                <T k="navcards.coinTypes.desc" />
              </p>
              <Link
                href="/coin-types"
                className="mt-4 inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
              >
                <T k="home.coinTypesSection.title" /> →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
