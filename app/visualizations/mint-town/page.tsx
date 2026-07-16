import { MintTownVisualization } from '@/components/visualizations/MintTownVisualization'
import { getAnsPointedSpadeMintStats, getAnsSquareSpadeMintStats } from '@/lib/ans-spade-data'
import { getPointedSpadeMintStats } from '@/lib/pointed-spade-data'

export const metadata = {
  title: 'Mint Town Visualization | Early Chinese Coin Finds',
  description:
    'Visualize mint-town coin production by quantity, drawn from database finds or the ANS spade catalogue.',
}

export default async function MintTownVisualizationPage() {
  const [db, ansPointed, ansSquare] = await Promise.all([
    getPointedSpadeMintStats(),
    Promise.resolve(getAnsPointedSpadeMintStats()),
    Promise.resolve(getAnsSquareSpadeMintStats()),
  ])

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <MintTownVisualization
        database={{ mapped: db.mapped, unmapped: db.unmapped }}
        ansPointed={ansPointed}
        ansSquare={ansSquare}
      />
    </div>
  )
}
