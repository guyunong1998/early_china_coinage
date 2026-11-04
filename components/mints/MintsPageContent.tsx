import Link from 'next/link'
import { AddMintSection } from '@/components/mints/AddMintSection'
import { MintListClient } from '@/components/mints/MintListClient'
import { MapOverviewCard } from '@/components/home/MapOverviewCard'
import { MapVisCanvas } from '@/components/map/MapVisCanvas'
import { T } from '@/components/i18n/T'
import { buildMintDirectory, mintCompleteness, toMintInfo, type MintTypeLabel } from '@/lib/mint-directory'
import { computeMintStatsFromView, toMintPoints } from '@/lib/mint-stats'
import { getImages, getMintStats, getMints } from '@/lib/queries'

/**
 * Shared render body for `/mints` (public, `authorized` always false so this
 * never touches `cookies()` and stays ISR-eligible) and `/mints/edit` (checks
 * the real session, redirects back to the public URL if not an admin).
 */
export async function MintsPageContent({ authorized }: { authorized: boolean }) {
  // Same points list the Mint Town map visualization shows by default (no
  // filter, no ANS toggle) — v_mint_stats aggregates the same numbers
  // computeMintStatsFromFinds would, without pulling the full finds table.
  const [dbMints, mintStatsRows, images] = await Promise.all([getMints(), getMintStats(), getImages()])
  const mints = buildMintDirectory(dbMints, images)

  const { mapped, unmapped } = computeMintStatsFromView(mintStatsRows, dbMints.map(toMintInfo))
  const mintPoints = toMintPoints(mapped)

  // Coin/site counts for the list cards below — covers every documented
  // mint, geolocated or not, keyed by the same canonical name_zh the
  // directory uses (a plain serializable object, since this crosses into a
  // client component as a prop).
  const statsByMint: Record<string, { coinCount: number; siteCount: number }> = {}
  ;[...mapped, ...unmapped].forEach((stat) => {
    statsByMint[stat.mint_zh] = { coinCount: stat.coinCount, siteCount: stat.siteCount }
  })

  // Bilingual coin-type tags per mint (v_mint_stats.type_labels: the deepest
  // populated hierarchy level, minor falling back to major) and distinct
  // catalogued coin_issues per mint (the "Number of issues" sort option) —
  // the latter different from statsByMint's coinCount/siteCount, which are
  // derived from `finds`, not from the coin_issues catalogue itself. Only
  // mints with at least one issue get an entry.
  const nameZhById = new Map(dbMints.map((m) => [m.id, m.name_zh]))
  const typesByMint: Record<string, MintTypeLabel[]> = {}
  const issuesByMint: Record<string, number> = {}
  mintStatsRows.forEach((row) => {
    const mintZh = nameZhById.get(row.mint_id)
    if (!mintZh || row.issue_count === 0) return
    issuesByMint[mintZh] = row.issue_count
    if (row.type_labels.length > 0) {
      typesByMint[mintZh] = [...row.type_labels].sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))
    }
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
        <div className="flex items-center justify-between">
          <h1 className="page-heading">
            <T k="mints.title" />
          </h1>
          {!authorized && (
            <Link href="/mints/edit" className="text-sm text-brand hover:underline">
              Edit
            </Link>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          <T k="mints.description" />{' '}
          <T k="mints.townsDocumented" vars={{ count: mints.length }} />
        </p>
        {authorized && (
          <div className="mt-3">
            <AddMintSection isDevMode={authorized} />
          </div>
        )}
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
