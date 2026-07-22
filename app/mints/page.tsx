import Link from 'next/link'
import { MintListClient } from '@/components/mints/MintListClient'
import { MapVisCanvas } from '@/components/map/MapVisCanvas'
import { T } from '@/components/i18n/T'
import { buildMintDirectory, buildMintTypeLabels, mintCompleteness } from '@/lib/mint-directory'
import { resolveMintNameZh } from '@/lib/mint-towns'
import { computeMintStatsFromFinds, toMintPoints } from '@/lib/pointed-spade-data'
import { getCoinIssues, getFindsForHeatmap, getMints } from '@/lib/queries'

export const metadata = {
  title: 'Mint Town Locations | Early Chinese Coin Finds',
  description: 'Browse and search recorded coin-producing centres of pre-Qin and early Han China.',
}

export const revalidate = 3600

export default async function MintsPage() {
  // Same points list the Mint Town map visualization shows by default (no
  // filter, no ANS toggle) — one source of truth so the two look identical.
  const [dbMints, finds, coinIssues] = await Promise.all([getMints(), getFindsForHeatmap(), getCoinIssues()])
  const mints = buildMintDirectory(dbMints)

  const { mapped, unmapped } = computeMintStatsFromFinds(finds, coinIssues, null)
  const mintPoints = toMintPoints(mapped)

  // Coin/site counts for the list cards below — covers every documented
  // mint, geolocated or not, keyed by the same canonical name_zh the
  // directory uses (a plain serializable object, since this crosses into a
  // client component as a prop).
  const statsByMint: Record<string, { coinCount: number; siteCount: number }> = {}
  ;[...mapped, ...unmapped].forEach((stat) => {
    statsByMint[stat.mint_zh] = { coinCount: stat.coinCount, siteCount: stat.siteCount }
  })

  // Bilingual coin-type tags per mint, computed live from coin_issues —
  // replaces the static dossier's English-only MintTown.coin_types wherever
  // live data exists (see buildMintTypeLabels' doc comment).
  const typesByMint = Object.fromEntries(buildMintTypeLabels(coinIssues))

  // Distinct catalogued coin_issues per mint (the "Number of issues" sort
  // option) — different from statsByMint's coinCount/siteCount, which are
  // derived from `finds`, not from the coin_issues catalogue itself.
  const issuesByMint: Record<string, number> = {}
  coinIssues.forEach((c) => {
    const mintZh = c.mint_zh?.trim()
    if (!mintZh) return
    const resolved = resolveMintNameZh(mintZh)
    issuesByMint[resolved] = (issuesByMint[resolved] ?? 0) + 1
  })

  // "Completion of information" sort option — how many of a mint's
  // documentable fields are actually filled in (see mintCompleteness).
  const completenessByMint: Record<string, number> = {}
  mints.forEach((mint) => {
    const hasCoinTypes = (typesByMint[mint.name_zh]?.length ?? 0) > 0 || mint.coin_types.length > 0
    completenessByMint[mint.name_zh] = mintCompleteness(mint, hasCoinTypes)
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
      </div>

      {/* Overview map — same left-third title/link + right-two-thirds map
          card the home page uses for its own map section. */}
      <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
        <div className="panel-nav-card-inner m-4 flex flex-col justify-center gap-0 p-4 lg:col-span-1">
          <h2 className="font-serif text-xl font-semibold text-brand">
            <T k="navcards.map.label" />
          </h2>
          <p className="text-sm leading-6 text-gray-600">
            <T k="navcards.map.desc" />
          </p>
          <Link
            href="/visualizations/mint-town"
            className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
          >
            <T k="home.mapSection.title" /> →
          </Link>
        </div>
        <div className="lg:col-span-2 p-4">
          <div className="relative overflow-hidden" style={{ height: '340px', width: '100%' }}>
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
        </div>
      </div>

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
