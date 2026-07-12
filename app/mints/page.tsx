import { MintListClient } from '@/components/mints/MintListClient'
import { MintsOverviewMap } from '@/components/mints/MintsOverviewMap'
import { MINT_TOWNS } from '@/lib/mint-towns'
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

  const dataSource =
    result.source === 'sheet'
      ? 'Google Sheets'
      : result.source === 'env_missing'
        ? 'local file'
        : 'local file (sheet error)'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">Mint Town Locations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Recorded coin-producing centres of pre-Qin and early Han China.{' '}
          <span className="font-medium text-brand">{mints.length} towns</span> currently documented.
          <span className="ml-2 text-xs text-gray-400">
            (data: {dataSource})
          </span>
        </p>
      </div>

      {/* Sheet error notice */}
      {result.source === 'error' && (
        <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Could not load Google Sheet ({result.message}). Showing data from the local file instead.
        </div>
      )}

      {/* Overview map */}
      <div className="mt-6 overflow-hidden border border-brand/20 bg-white shadow-sm">
        <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
          Geographic Overview
        </div>
        <MintsOverviewMap mints={mints} />
      </div>

      {/* Searchable list */}
      <div className="mt-8">
        <MintListClient all={mints} />
      </div>
    </div>
  )
}
