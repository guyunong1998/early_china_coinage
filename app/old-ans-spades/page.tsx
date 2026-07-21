import { HeatmapPanel } from '@/components/heatmap/HeatmapPanel'
import { getAnsPointedSpadeMintStats, getAnsSquareSpadeMintStats } from '@/lib/ans-spade-data'

export const metadata = {
  title: 'Old ANS Spades | Early Chinese Coin Finds',
  description:
    'Legacy distribution of spade coins by mint town from the ANS pointed-foot / square-foot catalogues, matched by inscription text rather than per-specimen reconciliation.',
}

export default async function OldAnsSpadesPage() {
  const [ansPointed, ansSquare] = await Promise.all([
    Promise.resolve(getAnsPointedSpadeMintStats()),
    Promise.resolve(getAnsSquareSpadeMintStats()),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">Old ANS Spades</h1>
      </div>

      <HeatmapPanel ansPointed={ansPointed} ansSquare={ansSquare} />
    </div>
  )
}
