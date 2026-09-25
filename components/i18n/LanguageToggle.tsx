'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export function LanguageToggle() {
  const { lang, toggle, t } = useLanguage()

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 items-center justify-center rounded border border-brand/30 px-2.5 text-xs font-semibold text-brand transition hover:bg-brand-light"
      aria-label={t('ui.toggleLanguage')}
    >
      {lang === 'en' ? '中' : 'EN'}
    </button>
  )
}
