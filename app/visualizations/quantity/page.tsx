import { QuantityVisualization } from '@/components/visualizations/QuantityVisualization'
import { VisualizationTabs } from '@/components/visualizations/VisualizationTabs'
import { T } from '@/components/i18n/T'
import { getAnsPointedSpadeMintStats, getAnsSquareSpadeMintStats } from '@/lib/ans-spade-data'
import { getPointedSpadeMintStats } from '@/lib/pointed-spade-data'

export const metadata = {
  title: 'Map Visualizations | Early Chinese Coin Finds',
  description:
    'Visualize mint-town coin production by quantity, drawn from database finds or the ANS spade catalogue.',
}

export default async function VisualizationsQuantityPage() {
  const [db, ansPointed, ansSquare] = await Promise.all([
    getPointedSpadeMintStats(),
    Promise.resolve(getAnsPointedSpadeMintStats()),
    Promise.resolve(getAnsSquareSpadeMintStats()),
  ])

  return (
    <div className="flex flex-col min-[1440px]:h-[calc(100dvh-4.5rem)] min-[1440px]:overflow-hidden">
      <div className="shrink-0 border-b border-brand/20 bg-white px-3 py-2 sm:px-4">
        <h1 className="font-serif text-lg font-semibold text-brand">
          <T k="nav.map" />
        </h1>
      </div>
      <QuantityVisualization
        database={{ mapped: db.mapped, unmapped: db.unmapped }}
        ansPointed={ansPointed}
        ansSquare={ansSquare}
        tabs={<VisualizationTabs />}
      />
    </div>
  )
}
