import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { MintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getCoinIssues, getCoinTypeHierarchy, getFindsForHeatmap, getMintInfos } from '@/lib/queries'
import { parseCommonDeeplinkParams } from '@/lib/visualization-deeplink'

type PageProps = {
  searchParams: Promise<{ view?: string; types?: string }>
}

export const metadata = {
  title: 'Mint Town Visualization | Early Chinese Coin Finds',
  description: 'Visualize mint-town coin production by quantity, filterable by coin type.',
}

export default async function MintTownVisualizationPage({ searchParams }: PageProps) {
  const { view, types } = await searchParams

  const [coinIssues, hierarchyRows, finds, mints] = await Promise.all([
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getMintInfos(),
  ])

  return (
    <FullViewportMapShell>
      <MintTownVisualization
        finds={finds}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        mints={mints}
        {...parseCommonDeeplinkParams(view, types)}
      />
    </FullViewportMapShell>
  )
}
