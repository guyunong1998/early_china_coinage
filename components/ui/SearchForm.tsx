import { TranslatedInput } from '@/components/i18n/TranslatedInput'

type SearchFormProps = {
  compact?: boolean
  defaultValue?: string
}

export function SearchForm({ compact = false, defaultValue = '' }: SearchFormProps) {
  return (
    <form action="/search" method="get" className="flex w-full gap-0 max-w-2xl">
      <TranslatedInput
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholderKey={compact ? 'search.placeholderCompact' : 'search.placeholder'}
        className={`search-input w-full px-3 text-sm text-gray-800 ${compact ? 'py-2' : 'py-3'}`}
      />
      {/* hover:shadow-none! overrides the site-wide button-hover ring (globals.css)
          for just this button — it should sit flush against the input, not glow. */}
      <button
        type="submit"
        className={`search-button hover:shadow-none! px-4 font-semibold ${compact ? 'py-2 text-sm' : 'py-3'}`}
      >
        →
      </button>
    </form>
  )
}
