import { TranslatedInput } from '@/components/i18n/TranslatedInput'

type SearchFormProps = {
  compact?: boolean
  defaultValue?: string
}

export function SearchForm({ compact = false, defaultValue = '' }: SearchFormProps) {
  return (
    <form action="/search" method="get" className="flex w-full gap-0">
      <TranslatedInput
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholderKey={compact ? 'search.placeholderCompact' : 'search.placeholder'}
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
