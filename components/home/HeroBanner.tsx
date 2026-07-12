import { SearchForm } from '@/components/ui/SearchForm'

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-brand text-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(0,45,48,0.92),rgba(0,109,113,0.75)),url('/images/hero-coins.svg')] bg-cover bg-center" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-brand-light/90">
            Archaeological Dataset
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight md:text-5xl">
            Early Chinese Coin Finds Database
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/90">
            A searchable record of pre-Qin to early Han coin discoveries across China — sites,
            contexts, typology, and geographic distribution.
          </p>
        </div>
        <div className="rounded bg-white/95 p-5 shadow-lg">
          <p className="mb-3 text-sm font-semibold text-brand">Search the database</p>
          <SearchForm />
          <p className="mt-3 text-xs text-gray-600">
            Search by site name, province, coin type, inscription, or site code.
          </p>
        </div>
      </div>
    </section>
  )
}
