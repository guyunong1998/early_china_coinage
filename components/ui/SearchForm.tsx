'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type SearchFormProps = {
  compact?: boolean
  defaultValue?: string
}

export function SearchForm({ compact = false, defaultValue = '' }: SearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-0">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={compact ? 'Search sites…' : 'Search by site, province, type, inscription…'}
        className={`w-full border border-brand/30 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand ${
          compact ? 'rounded-l py-2' : 'rounded-l py-3'
        }`}
      />
      <button
        type="submit"
        className={`bg-brand px-4 font-semibold text-white hover:bg-brand-dark ${
          compact ? 'rounded-r py-2 text-sm' : 'rounded-r py-3'
        }`}
      >
        →
      </button>
    </form>
  )
}
