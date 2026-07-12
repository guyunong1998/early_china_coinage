'use client'

import { useState } from 'react'

type CopyButtonProps = {
  value: string
}

export function CopyButton({ value }: CopyButtonProps) {
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
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
