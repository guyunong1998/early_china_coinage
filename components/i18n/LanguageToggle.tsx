'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export function LanguageToggle() {
  const { lang, toggle } = useLanguage()

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded border border-brand/30 px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand-light"
      aria-label="Toggle language"
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  )
}
