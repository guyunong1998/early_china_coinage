'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type CopyButtonProps = {
  value: string
}

export function CopyButton({ value }: CopyButtonProps) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 rounded border border-brand/30 px-2 py-0.5 text-xs text-brand hover:bg-brand-light"
    >
      {copied ? t('ui.copied') : t('ui.copy')}
    </button>
  )
}
