import { HeatmapPanel } from '@/components/heatmap/HeatmapPanel'
import { getAnsPointedSpadeMintStats, getAnsSquareSpadeMintStats } from '@/lib/ans-spade-data'
import { getPointedSpadeMintStats } from '@/lib/pointed-spade-data'

export const metadata = {
  title: 'Heatmap | Early Chinese Coin Finds',
  description:
    'Distribution of spade coins by mint town — database finds or the ANS pointed-foot / square-foot catalogues.',
}

export default async function HeatmapPage() {
  const [db, ansPointed, ansSquare] = await Promise.all([
    getPointedSpadeMintStats(),
    Promise.resolve(getAnsPointedSpadeMintStats()),
    Promise.resolve(getAnsSquareSpadeMintStats()),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">Heatmap</h1>
      </div>

      <HeatmapPanel
        database={{
          mapped: db.mapped,
          unmapped: db.unmapped,
          totalCoins: db.mapped.reduce((sum, m) => sum + m.coinCount, 0),
          totalFinds: db.mapped.reduce((sum, m) => sum + m.findCount, 0),
        }}
        ansPointed={ansPointed}
        ansSquare={ansSquare}
      />
    </div>
  )
}
