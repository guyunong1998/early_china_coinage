import { Suspense } from 'react'
import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { MapLoadingOverlay } from '@/components/visualizations/MapLoadingOverlay'
import { FindSpotsVisualization } from '@/components/visualizations/MapVisualization'
import { getCoinIssues, getCoinTypeHierarchy, getFindSpotsMapSites, getFindsForHeatmap, getMintInfos } from '@/lib/queries'

export const metadata = {
  title: 'Find Site Visualization | Early Chinese Coin Finds',
  description:
    'Interactive map of georeferenced coin find sites with coin-type and mint-based filtering.',
}

export const revalidate = 86400

// Precision filter and deep-link params (precision/mode/view/mints/types) are
// read client-side via useSearchParams, so this page never touches
// searchParams and stays statically cached. The Suspense boundary is what
// useSearchParams requires on a static route.
export default async function FindSiteVisualizationPage() {
  const [sites, coinIssues, hierarchyRows, finds, mints] = await Promise.all([
    getFindSpotsMapSites(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getMintInfos(),
  ])

  return (
    <FullViewportMapShell>
      <Suspense fallback={<MapLoadingOverlay />}>
        <FindSpotsVisualization
          sites={sites}
          coinIssues={coinIssues}
          hierarchyRows={hierarchyRows}
          finds={finds}
          mints={mints}
        />
      </Suspense>
    </FullViewportMapShell>
  )
}
