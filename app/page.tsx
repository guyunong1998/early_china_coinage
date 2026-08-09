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

        {/* Typology Viewer teaser — same left/right split as the Map
            Visualizations section above, just with the preview as the
            larger two-thirds since it's the whole point here (a mini
            version of /coin-types' full viewer). Each side is now its own
            bordered box rather than sharing one outer frame, matching the
            Map Visualizations split above. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="panel-nav-card overflow-hidden p-4 lg:col-span-2">
            <TypologyViewer src="/images/coin-type-hierarchy.png" manifest={typologyManifest} height={440} />
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
