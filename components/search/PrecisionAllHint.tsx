'use client'

import { ClickHint } from '@/components/ui/ClickHint'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/**
 * The "?" badge next to the Location precision filter's "All" tab (both
 * here and components/visualizations/MapVisualization.tsx's precisionButtons)
 * — a client-boundary wrapper since app/search/page.tsx itself is a server
 * component and can't call useLanguage() directly to resolve
 * search.precision.allHint into a plain string for ClickHint's `hint` prop.
 */
export function PrecisionAllHint() {
  const { t } = useLanguage()
  return (
    <ClickHint
      hint={t('search.precision.allHint')}
      className="flex h-4 w-4 items-center justify-center rounded-full border border-brand/40 bg-white text-[10px] font-bold leading-none text-brand shadow-sm"
    >
      ?
    </ClickHint>
  )
}
