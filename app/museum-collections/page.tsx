import { Suspense } from 'react'
import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { MapLoadingOverlay } from '@/components/visualizations/MapLoadingOverlay'
import { AnsMintTownVisualization } from '@/components/visualizations/MapVisualization'
import { getAnsSpecimens } from '@/lib/ans-museum-data'
import { getMintInfos } from '@/lib/queries'

export const metadata = {
  title: 'Museum Collections | Early Chinese Coin Finds',
  description: 'Mint-town distribution of ANS museum specimens, searchable by accession number.',
}

export const revalidate = 86400

// Deep-link params (view/types) are read client-side via useSearchParams, so
// this page never touches searchParams and stays statically cached. The
// Suspense boundary is what useSearchParams requires on a static route.
export default async function MuseumCollectionsPage() {
  const [specimens, mints] = await Promise.all([getAnsSpecimens(), getMintInfos()])

  return (
    <FullViewportMapShell>
      <Suspense fallback={<MapLoadingOverlay />}>
        <AnsMintTownVisualization specimens={specimens} mints={mints} />
      </Suspense>
    </FullViewportMapShell>
  )
}
