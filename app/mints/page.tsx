import Link from 'next/link'
import { MintListClient } from '@/components/mints/MintListClient'
import { MapVisCanvas } from '@/components/map/MapVisCanvas'
import { T } from '@/components/i18n/T'
import { MINT_TOWNS } from '@/lib/mint-towns'
import { computeMintStatsFromFinds, toMintPoints } from '@/lib/pointed-spade-data'
import { getCoinTypes, getFindsForHeatmap } from '@/lib/queries'
import { fetchMintsFromSheet } from '@/lib/sheets'

export const metadata = {
  title: 'Mint Town Locations | Early Chinese Coin Finds',
  description: 'Browse and search recorded coin-producing centres of pre-Qin and early Han China.',
}

// Revalidate at most once per hour (matches GOOGLE_SHEET_REVALIDATE_SECONDS)
export const revalidate = 3600

export default async function MintsPage() {
  // Try Google Sheet first; fall back to static file
  const result = await fetchMintsFromSheet()

  const mints =
    result.source === 'sheet' && result.mints.length > 0
      ? result.mints
      : MINT_TOWNS

  // Same points list the Mint Town map visualization shows by default (no
  // filter, no ANS toggle) — one source of truth so the two look identical.
  const [finds, coinTypes] = await Promise.all([getFindsForHeatmap(), getCoinTypes()])
  const { mapped, unmapped } = computeMintStatsFromFinds(finds, coinTypes, null)
  const mintPoints = toMintPoints(mapped)

  // Coin/site counts for the list cards below — covers every documented
  // mint, geolocated or not, keyed by the same canonical name_zh MINT_TOWNS
  // uses (a plain serializable object, since this crosses into a client
  // component as a prop).
  const statsByMint: Record<string, { coinCount: number; siteCount: number }> = {}
  ;[...mapped, ...unmapped].forEach((stat) => {
    statsByMint[stat.mint_zh] = { coinCount: stat.coinCount, siteCount: stat.siteCount }
  })

  const dataSource =
    result.source === 'sheet'
      ? 'Google Sheets'
      : result.source === 'env_missing'
        ? 'local file'
        : 'local file (sheet error)'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="mints.title" />
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          <T k="mints.description" />{' '}
          <T k="mints.townsDocumented" vars={{ count: mints.length }} />
          <span className="ml-2 text-xs text-gray-400">
            (data: {dataSource})
          </span>
        </p>
      </div>

      {/* Sheet error notice */}
      {result.source === 'error' && (
        <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <T k="mints.sheetError" vars={{ message: result.message }} />
        </div>
      )}

      {/* Overview map — same left-third title/link + right-two-thirds map
          card the home page uses for its own map section. */}
      <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
        <div className="flex flex-col justify-center gap-3 p-6 lg:col-span-1">
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
        <MintListClient all={mints} statsByMint={statsByMint} />
      </div>
    </div>
  )
}
