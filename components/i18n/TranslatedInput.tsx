'use client'

import type { InputHTMLAttributes } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

type TranslatedInputProps = {
  placeholderKey: DictionaryKey
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'>

export function TranslatedInput({ placeholderKey, ...props }: TranslatedInputProps) {
  const { t } = useLanguage()
  return <input {...props} placeholder={t(placeholderKey)} />
}
