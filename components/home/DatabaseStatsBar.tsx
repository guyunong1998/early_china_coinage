'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatNumber } from '@/lib/format'
import type { DatabaseStats } from '@/lib/types'

export function DatabaseStatsBar({ stats }: { stats: DatabaseStats }) {
  const { t } = useLanguage()
  const vars = {
    coins: formatNumber(stats.totalCoins),
    sites: formatNumber(stats.siteCount),
    finds: formatNumber(stats.findCount),
  }

  return (
    <p className="border border-brand/20 bg-white px-4 py-3 text-center text-sm text-gray-700">
      {stats.findCount > 0 ? t('stats.summaryWithFinds', vars) : t('stats.summary', vars)}
    </p>
  )
}
