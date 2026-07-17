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
  const { mapped } = computeMintStatsFromFinds(finds, coinTypes, null)
  const mintPoints = toMintPoints(mapped)

  const dataSource =
    result.source === 'sheet'
      ? 'Google Sheets'
      : result.source === 'env_missing'
        ? 'local file'
        : 'local file (sheet error)'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
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

      {/* Overview map */}
      <div className="mt-6">
        <div className="panel-header inline-block px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="mints.overview" />
        </div>
        <div className="panel-body relative overflow-hidden" style={{ height: '340px', width: '100%' }}>
          <MapVisCanvas
            kind="mints"
            mintPoints={mintPoints}
            mintStates={null}
            viewMode="points"
            densityLatLngs={[]}
            height="340px"
          />
        </div>
        <p className="mt-2 text-sm">
          <Link href="/visualizations/mint-town" className="text-brand hover:underline">
            <T k="mints.moreMapVisualizations" />
          </Link>
        </p>
      </div>

      {/* Searchable list */}
      <div className="mt-8">
        <MintListClient all={mints} />
      </div>
    </div>
  )
}
