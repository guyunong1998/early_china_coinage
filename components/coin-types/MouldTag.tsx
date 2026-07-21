'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

/**
 * "This type is a mould, not a coin" tag — isMould comes from
 * lib/coin-type-catalog.ts's isMouldNode (a node under the 钱范 level1
 * branch of the live coin_type_hierarchy table). Shows "M" or "范" to match
 * the active language, same as every other bilingual label on the site.
 */
export function MouldTag({ isMould = false }: { isMould?: boolean }) {
  const { t } = useLanguage()
  if (!isMould) return null
  return (
    <span
      title="Mould / 范"
      className="shrink-0 rounded bg-gray-700 px-1.5 py-0.5 text-xs font-bold text-white"
    >
      {t('coinType.mouldTag')}
    </span>
  )
}
