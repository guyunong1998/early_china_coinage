'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

export function T({
  k,
  vars,
}: {
  k: DictionaryKey
  vars?: Record<string, string | number>
}) {
  const { t } = useLanguage()
  return <>{t(k, vars)}</>
}
