'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

/** Add an entry here to add another map visualization tab. */
export const VISUALIZATION_TABS: { href: string; labelKey: DictionaryKey }[] = [
  { href: '/visualizations/quantity', labelKey: 'visualizations.tabs.quantity' },
  { href: '/visualizations/coin-type', labelKey: 'visualizations.tabs.coinType' },
  { href: '/visualizations/mint', labelKey: 'visualizations.tabs.mint' },
]

/** Lives at the top of the sidebar on every map visualizations tab —
 * "visualize by" quantity / coin type / mint. */
export function VisualizationTabs() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <T k="visualizations.tabs.label" />
      </span>
      {VISUALIZATION_TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`w-full border px-3 py-1.5 text-left text-sm font-semibold transition-colors ${
              active
                ? 'border-brand bg-brand text-white'
                : 'border-brand/30 bg-white text-brand hover:bg-brand-light'
            }`}
          >
            {t(tab.labelKey)}
          </Link>
        )
      })}
    </div>
  )
}
