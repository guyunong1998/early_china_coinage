import { AnsMintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getAnsSpecimens } from '@/lib/ans-museum-data'
import { getCoinIssues, getCoinTypeHierarchy } from '@/lib/queries'

export const metadata = {
  title: 'Museum Collections | Early Chinese Coin Finds',
  description: 'Mint-town distribution of ANS museum specimens, searchable by accession number.',
}

export default async function MuseumCollectionsPage() {
  const [specimens, coinIssues, hierarchyRows] = await Promise.all([
    getAnsSpecimens(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
  ])

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <AnsMintTownVisualization specimens={specimens} coinIssues={coinIssues} hierarchyRows={hierarchyRows} />
    </div>
  )
}
