import { AnsMintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getAnsSpecimens } from '@/lib/ans-museum-data'
import { toMintInfo } from '@/lib/mint-directory'
import { getCoinIssues, getCoinTypeHierarchy, getMints } from '@/lib/queries'
import { decodeTypologySelections, parseViewMode } from '@/lib/visualization-deeplink'

type PageProps = {
  searchParams: Promise<{ view?: string; types?: string }>
}

export const metadata = {
  title: 'Museum Collections | Early Chinese Coin Finds',
  description: 'Mint-town distribution of ANS museum specimens, searchable by accession number.',
}

export default async function MuseumCollectionsPage({ searchParams }: PageProps) {
  const { view, types } = await searchParams

  const [specimens, coinIssues, hierarchyRows, dbMints] = await Promise.all([
    getAnsSpecimens(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getMints(),
  ])
  const mints = dbMints.map(toMintInfo)

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <AnsMintTownVisualization
        specimens={specimens}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        mints={mints}
        initialViewMode={parseViewMode(view)}
        initialTypeSelections={decodeTypologySelections(types)}
      />
    </div>
  )
}
