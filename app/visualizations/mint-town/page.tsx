import { MintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getCoinIssues, getCoinTypeHierarchy, getFindsForHeatmap } from '@/lib/queries'

export const metadata = {
  title: 'Mint Town Visualization | Early Chinese Coin Finds',
  description: 'Visualize mint-town coin production by quantity, filterable by coin type.',
}

export default async function MintTownVisualizationPage() {
  const [coinIssues, hierarchyRows, finds] = await Promise.all([
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
  ])

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <MintTownVisualization finds={finds} coinIssues={coinIssues} hierarchyRows={hierarchyRows} />
    </div>
  )
}
