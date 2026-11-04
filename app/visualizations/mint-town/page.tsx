import { Suspense } from 'react'
import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { MapLoadingOverlay } from '@/components/visualizations/MapLoadingOverlay'
import { MintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getCoinIssues, getCoinTypeHierarchy, getFindsForHeatmap, getMintInfos } from '@/lib/queries'

export const metadata = {
  title: 'Mint Town Visualization | Early Chinese Coin Finds',
  description: 'Visualize mint-town coin production by quantity, filterable by coin type.',
}

export const revalidate = 86400

// Deep-link params (view/types) are read client-side via useSearchParams, so
// this page never touches searchParams and stays statically cached. The
// Suspense boundary is what useSearchParams requires on a static route.
export default async function MintTownVisualizationPage() {
  const [coinIssues, hierarchyRows, finds, mints] = await Promise.all([
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getMintInfos(),
  ])

  return (
    <FullViewportMapShell>
      <Suspense fallback={<MapLoadingOverlay />}>
        <MintTownVisualization finds={finds} coinIssues={coinIssues} hierarchyRows={hierarchyRows} mints={mints} />
      </Suspense>
    </FullViewportMapShell>
  )
}
