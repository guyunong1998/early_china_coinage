import { AddMintSection } from '@/components/mints/AddMintSection'
import { MintListClient } from '@/components/mints/MintListClient'
import { MapOverviewCard } from '@/components/home/MapOverviewCard'
import { MapVisCanvas } from '@/components/map/MapVisCanvas'
import { T } from '@/components/i18n/T'
import { isAuthorized } from '@/lib/admin/guard'
import { buildMintDirectory, buildMintTypeLabels, mintCompleteness, toMintInfo } from '@/lib/mint-directory'
import { computeMintStatsFromFinds, toMintPoints } from '@/lib/mint-stats'
import { getCoinIssues, getFindsForHeatmap, getImages, getMints } from '@/lib/queries'

export const metadata = {
  title: 'Mint Town Locations | Early Chinese Coin Finds',
  description: 'Browse and search recorded coin-producing centres of pre-Qin and early Han China.',
}

export const revalidate = 86400

export default async function MintsPage() {
  // Same points list the Mint Town map visualization shows by default (no
  // filter, no ANS toggle) — one source of truth so the two look identical.
  const [dbMints, finds, coinIssues, images] = await Promise.all([
    getMints(),
    getFindsForHeatmap(),
    getCoinIssues(),
    getImages(),
  ])
  const mints = buildMintDirectory(dbMints, images)
  const authorized = await isAuthorized()

  const { mapped, unmapped } = computeMintStatsFromFinds(finds, coinIssues, null, dbMints.map(toMintInfo))
  const mintPoints = toMintPoints(mapped)

  // Coin/site counts for the list cards below — covers every documented
  // mint, geolocated or not, keyed by the same canonical name_zh the
  // directory uses (a plain serializable object, since this crosses into a
  // client component as a prop).
  const statsByMint: Record<string, { coinCount: number; siteCount: number }> = {}
  ;[...mapped, ...unmapped].forEach((stat) => {
    statsByMint[stat.mint_zh] = { coinCount: stat.coinCount, siteCount: stat.siteCount }
  })

  // Bilingual coin-type tags per mint, computed live from coin_issues (see
  // buildMintTypeLabels' doc comment).
  const typesByMint = Object.fromEntries(buildMintTypeLabels(coinIssues))

  // Distinct catalogued coin_issues per mint (the "Number of issues" sort
  // option) — different from statsByMint's coinCount/siteCount, which are
  // derived from `finds`, not from the coin_issues catalogue itself.
  const issuesByMint: Record<string, number> = {}
  coinIssues.forEach((c) => {
    const mintZh = c.mint_zh?.trim()
    if (!mintZh) return
    issuesByMint[mintZh] = (issuesByMint[mintZh] ?? 0) + 1
  })

  // "Completion of information" sort option — how many of a mint's
  // documentable fields are actually filled in (see mintCompleteness).
  const completenessByMint: Record<string, number> = {}
  mints.forEach((mint) => {
    completenessByMint[mint.name_zh] = mintCompleteness(mint)
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="mints.title" />
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          <T k="mints.description" />{' '}
          <T k="mints.townsDocumented" vars={{ count: mints.length }} />
        </p>
        <div className="mt-3">
          <AddMintSection isDevMode={authorized} />
        </div>
      </div>

      <MapOverviewCard href="/visualizations/mint-town">
        <div className="relative h-[340px] w-full overflow-hidden">
          <MapVisCanvas
            kind="mints"
            mintPoints={mintPoints}
            mintStates={null}
            viewMode="points"
            densityLatLngs={[]}
            fullControls={false}
            height="340px"
          />
        </div>
      </MapOverviewCard>

      {/* Searchable list */}
      <div className="mt-8">
        <MintListClient
          all={mints}
          statsByMint={statsByMint}
          typesByMint={typesByMint}
          issuesByMint={issuesByMint}
          completenessByMint={completenessByMint}
        />
      </div>
    </div>
  )
}
