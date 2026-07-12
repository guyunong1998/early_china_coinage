import { formatNumber } from '@/lib/format'
import type { DatabaseStats } from '@/lib/types'

export function DatabaseStatsBar({ stats }: { stats: DatabaseStats }) {
  return (
    <p className="border border-brand/20 bg-white px-4 py-3 text-center text-sm text-gray-700">
      Currently in the database:{' '}
      <strong className="text-brand">{formatNumber(stats.totalCoins)}</strong> coins in{' '}
      <strong className="text-brand">{formatNumber(stats.siteCount)}</strong> validated sites
      {stats.findCount > 0 && (
        <>
          {' '}across{' '}
          <strong className="text-brand">{formatNumber(stats.findCount)}</strong> find records
        </>
      )}.
    </p>
  )
}
