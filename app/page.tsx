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
        <NavCards />

        <div className="mt-4">
          <Link
            href="/visualizations"
            className="panel-header inline-block px-4 py-2 text-sm font-bold uppercase tracking-wide hover:underline"
          >
            <T k="home.mapSection.title" />
          </Link>
          <div className="panel-body overflow-hidden">
            <CoinFilterMap sites={sites} />
          </div>
        </div>
      </div>
    </>
  )
}
