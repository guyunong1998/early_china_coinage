import { FindSpotsVisualization } from '@/components/visualizations/MapVisualization'
import {
  countSitesByPrecision,
  parsePrecisionFilter,
  siteMatchesPrecisionFilter,
} from '@/lib/city-boundaries'
import { getCoinIssues, getCoinTypeHierarchy, getFindSpotsMapSites, getFindsForHeatmap } from '@/lib/queries'

type PageProps = {
  searchParams: Promise<{ precision?: string }>
}

export const metadata = {
  title: 'Find Site Visualization | Early Chinese Coin Finds',
  description:
    'Interactive map of georeferenced coin find sites with coin-type and mint-based filtering.',
}

export default async function FindSiteVisualizationPage({ searchParams }: PageProps) {
  const { precision: precisionParam } = await searchParams
  const currentPrecision = parsePrecisionFilter(precisionParam)

  const [allSites, coinIssues, hierarchyRows, finds] = await Promise.all([
    getFindSpotsMapSites(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
  ])

  const counts = countSitesByPrecision(allSites)
  const sites = allSites.filter((site) => siteMatchesPrecisionFilter(site, currentPrecision))

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <FindSpotsVisualization
        sites={sites}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        finds={finds}
        currentPrecision={currentPrecision}
        precisionCounts={counts}
      />
    </div>
  )
}
