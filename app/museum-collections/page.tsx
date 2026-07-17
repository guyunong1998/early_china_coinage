import { HeatmapPanel } from '@/components/heatmap/HeatmapPanel'
import { getAnsPointedSpadeMintStats, getAnsSquareSpadeMintStats } from '@/lib/ans-spade-data'

export const metadata = {
  title: 'Museum Collections | Early Chinese Coin Finds',
  description:
    'Distribution of spade coins by mint town from the ANS pointed-foot / square-foot catalogues.',
}

export default async function MuseumCollectionsPage() {
  const [ansPointed, ansSquare] = await Promise.all([
    Promise.resolve(getAnsPointedSpadeMintStats()),
    Promise.resolve(getAnsSquareSpadeMintStats()),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">Museum Collections</h1>
      </div>

      <HeatmapPanel ansPointed={ansPointed} ansSquare={ansSquare} />
    </div>
  )
}
