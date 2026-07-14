'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DICTIONARY, type DictionaryKey, type Lang } from '@/lib/i18n/dictionary'

const STORAGE_KEY = 'ecc-lang'

export type TFunction = (key: DictionaryKey, vars?: Record<string, string | number>) => string

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  toggle: () => void
  t: TFunction
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    text
  )
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    // Reading localStorage during SSR would cause a hydration mismatch, so
    // the server-rendered default ('en') is deliberately corrected once,
    // client-side, right after mount.
    const stored = window.localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'en' || stored === 'zh') setLangState(stored)
  }, [])

  function setLang(next: Lang) {
    setLangState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  function toggle() {
    setLang(lang === 'en' ? 'zh' : 'en')
  }

  function t(key: DictionaryKey, vars?: Record<string, string | number>) {
    return interpolate(DICTIONARY[key][lang], vars)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
