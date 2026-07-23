import Link from 'next/link'
import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { DemoVisualizationsCarousel } from '@/components/home/DemoVisualizationsCarousel'
import { TypologyViewer } from '@/components/coin-types/TypologyViewer'
import { T } from '@/components/i18n/T'
import { loadTypologyManifest } from '@/lib/typology-manifest'

export default function Home() {
  const typologyManifest = loadTypologyManifest()

  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <NavCards />
        </div>
        <DemoVisualizationsCarousel />

        {/* Typology Viewer teaser — same left-third title/link + right-two-
            thirds preview card the Map Visualizations section above uses,
            just with the panel as the larger two-thirds since it's the
            whole point here (a mini version of /coin-types' full viewer). */}
        <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
          <div className="panel-nav-card-inner m-4 flex flex-col justify-center gap-0 p-4 lg:col-span-1">
            <h2 className="font-serif text-xl font-semibold text-brand">
              <T k="nav.coinTypes" />
            </h2>
            <p className="text-sm leading-6 text-gray-600">
              <T k="navcards.coinTypes.desc" />
            </p>
            <Link
              href="/coin-types"
              className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
            >
              <T k="home.coinTypesSection.title" /> →
            </Link>
          </div>
          <div className="lg:col-span-2 p-4">
            <TypologyViewer src="/images/coin-type-hierarchy.png" manifest={typologyManifest} height={440} />
          </div>
        </div>
      </div>
    </>
  )
}
