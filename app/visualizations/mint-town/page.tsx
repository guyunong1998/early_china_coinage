import { MintTownVisualization } from '@/components/visualizations/MapVisualization'
import { toMintInfo } from '@/lib/mint-directory'
import { getCoinIssues, getCoinTypeHierarchy, getFindsForHeatmap, getMints } from '@/lib/queries'
import { decodeTypologySelections, parseViewMode } from '@/lib/visualization-deeplink'

type PageProps = {
  searchParams: Promise<{ view?: string; types?: string }>
}

export const metadata = {
  title: 'Mint Town Visualization | Early Chinese Coin Finds',
  description: 'Visualize mint-town coin production by quantity, filterable by coin type.',
}

export default async function MintTownVisualizationPage({ searchParams }: PageProps) {
  const { view, types } = await searchParams

  const [coinIssues, hierarchyRows, finds, dbMints] = await Promise.all([
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getMints(),
  ])
  const mints = dbMints.map(toMintInfo)

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <MintTownVisualization
        finds={finds}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        mints={mints}
        initialViewMode={parseViewMode(view)}
        initialTypeSelections={decodeTypologySelections(types)}
      />
    </div>
  )
}
