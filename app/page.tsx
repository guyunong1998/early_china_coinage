import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { CoinFilterMap } from '@/components/home/CoinFilterMap'
import { getMapSites } from '@/lib/queries'

export default async function Home() {
  const sites = await getMapSites()

  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <NavCards />

        <div className="mt-4">
          <CoinFilterMap sites={sites} />
        </div>
      </div>
    </>
  )
}
