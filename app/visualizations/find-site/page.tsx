import { FindSpotsVisualization } from '@/components/visualizations/MapVisualization'
import {
  countSitesByPrecision,
  parsePrecisionFilter,
  siteMatchesPrecisionFilter,
} from '@/lib/city-boundaries'
import { toMintInfo } from '@/lib/mint-directory'
import { getCoinIssues, getCoinTypeHierarchy, getFindSpotsMapSites, getFindsForHeatmap, getMints } from '@/lib/queries'
import {
  decodeMintNames,
  decodeTypologySelections,
  parseFilterMode,
  parseViewMode,
} from '@/lib/visualization-deeplink'

type PageProps = {
  searchParams: Promise<{ precision?: string; mode?: string; view?: string; mints?: string; types?: string }>
}

export const metadata = {
  title: 'Find Site Visualization | Early Chinese Coin Finds',
  description:
    'Interactive map of georeferenced coin find sites with coin-type and mint-based filtering.',
}

export default async function FindSiteVisualizationPage({ searchParams }: PageProps) {
  const { precision: precisionParam, mode, view, mints: mintsParam, types } = await searchParams
  const currentPrecision = parsePrecisionFilter(precisionParam)

  const [allSites, coinIssues, hierarchyRows, finds, dbMints] = await Promise.all([
    getFindSpotsMapSites(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getMints(),
  ])
  const mints = dbMints.map(toMintInfo)

  const counts = countSitesByPrecision(allSites)
  const sites = allSites.filter((site) => siteMatchesPrecisionFilter(site, currentPrecision))

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <FindSpotsVisualization
        sites={sites}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        finds={finds}
        mints={mints}
        currentPrecision={currentPrecision}
        precisionCounts={counts}
        initialMode={parseFilterMode(mode)}
        initialViewMode={parseViewMode(view)}
        initialMintNames={decodeMintNames(mintsParam)}
        initialTypeSelections={decodeTypologySelections(types)}
      />
    </div>
  )
}
