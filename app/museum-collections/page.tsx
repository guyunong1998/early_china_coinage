import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { AnsMintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getAnsSpecimens } from '@/lib/ans-museum-data'
import { getCoinIssues, getCoinTypeHierarchy, getMintInfos } from '@/lib/queries'
import { parseCommonDeeplinkParams } from '@/lib/visualization-deeplink'

type PageProps = {
  searchParams: Promise<{ view?: string; types?: string }>
}

export const metadata = {
  title: 'Museum Collections | Early Chinese Coin Finds',
  description: 'Mint-town distribution of ANS museum specimens, searchable by accession number.',
}

export default async function MuseumCollectionsPage({ searchParams }: PageProps) {
  const { view, types } = await searchParams

  const [specimens, coinIssues, hierarchyRows, mints] = await Promise.all([
    getAnsSpecimens(),
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getMintInfos(),
  ])

  return (
    <FullViewportMapShell>
      <AnsMintTownVisualization
        specimens={specimens}
        coinIssues={coinIssues}
        hierarchyRows={hierarchyRows}
        mints={mints}
        {...parseCommonDeeplinkParams(view, types)}
      />
    </FullViewportMapShell>
  )
}
