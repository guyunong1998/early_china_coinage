import { DatabaseStatsBar } from '@/components/home/DatabaseStatsBar'
import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { NewsPanel } from '@/components/home/NewsPanel'
import { CoinFilterMap } from '@/components/home/CoinFilterMap'
import { getDatabaseStats, getMapSites } from '@/lib/queries'

export default async function Home() {
  const [stats, sites] = await Promise.all([getDatabaseStats(), getMapSites()])

  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <NavCards />
          <NewsPanel />
        </div>

        <div className="mt-4">
          <DatabaseStatsBar stats={stats} />
        </div>

        <div className="mt-4">
          <CoinFilterMap sites={sites} />
        </div>
      </div>
    </>
  )
}
