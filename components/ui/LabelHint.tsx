'use client'

import { ClickHint } from '@/components/ui/ClickHint'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

/**
 * Wraps a field label in the same dotted-underline/cursor-help styling used
 * for map labels (e.g. MapVisualization.tsx's "View by") — the label text
 * itself is the click target, not a separate "?" mark. A client-boundary
 * wrapper since it needs useLanguage() to resolve both keys, letting
 * server-component pages (e.g. app/sites/[site_code]/page.tsx) use it
 * without becoming client components themselves.
 */
export function LabelHint({ labelKey, hintKey }: { labelKey: DictionaryKey; hintKey: DictionaryKey }) {
  const { t } = useLanguage()
  return (
    <ClickHint hint={t(hintKey)} className="cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2">
      {t(labelKey)}
    </ClickHint>
  )
}
