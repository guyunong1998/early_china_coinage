import { DatabaseStatsBar } from '@/components/home/DatabaseStatsBar'
import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { getDatabaseStats } from '@/lib/queries'

export default async function Home() {
  const stats = await getDatabaseStats()

  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-8">
        <NavCards />

        <div className="mt-6">
          <DatabaseStatsBar stats={stats} />
        </div>
      </div>
    </>
  )
}
