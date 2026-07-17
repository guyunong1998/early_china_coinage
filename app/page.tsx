import Link from 'next/link'
import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { CoinFilterMap } from '@/components/map/CoinFilterMap'
import { T } from '@/components/i18n/T'
import { getMapSites } from '@/lib/queries'

export default async function Home() {
  const sites = await getMapSites()

  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <NavCards />
        </div>
        <div className="panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
          <div className="flex flex-col justify-center gap-3 p-6 lg:col-span-1">
            <h2 className="font-serif text-xl font-semibold text-brand">
              <T k="navcards.map.label" />
            </h2>
            <p className="text-sm leading-6 text-gray-600">
              <T k="navcards.map.desc" />
            </p>
            <Link
              href="/visualizations"
              className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
            >
              <T k="home.mapSection.title" /> →
            </Link>
          </div>
          <div className="lg:col-span-2 p-4">
            <CoinFilterMap sites={sites} />
          </div>
        </div>

        
      </div>
    </>
  )
}
