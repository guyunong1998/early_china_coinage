import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { FindSpotsVisualization } from '@/components/visualizations/MapVisualization'
import {
  countSitesByPrecision,
  parsePrecisionFilter,
  siteMatchesPrecisionFilter,
} from '@/lib/city-boundaries'
import { getCoinIssues, getCoinTypeHierarchy, getFindSpotsMapSites, getFindsForHeatmap, getMintInfos } from '@/lib/queries'
import { decodeMintNames, parseCommonDeeplinkParams, parseFilterMode } from '@/lib/visualization-deeplink'

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

  const [allSites, coinIssues, hierarchyRows, finds, mints] = await Promise.all([
    getFindSpotsMapSites(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getMintInfos(),
  ])

  const counts = countSitesByPrecision(allSites)
  const sites = allSites.filter((site) => siteMatchesPrecisionFilter(site, currentPrecision))

  return (
    <FullViewportMapShell>
      <FindSpotsVisualization
        sites={sites}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        finds={finds}
        mints={mints}
        currentPrecision={currentPrecision}
        precisionCounts={counts}
        initialMode={parseFilterMode(mode)}
        initialMintNames={decodeMintNames(mintsParam)}
        {...parseCommonDeeplinkParams(view, types)}
      />
    </FullViewportMapShell>
  )
}
