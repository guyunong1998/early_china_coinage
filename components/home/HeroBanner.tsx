import { SearchForm } from '@/components/ui/SearchForm'
import { T } from '@/components/i18n/T'

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-brand text-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(0,45,48,0.92),rgba(0,109,113,0.75)),url('/images/hero-coins.svg')] bg-cover bg-center" />
      <div className="relative mx-auto grid max-w-5xl gap-8 px-4 py-14">
        <div>
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-brand-light/90">
            <T k="hero.tagline" />
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight md:text-5xl">
            <T k="hero.title" />
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/90">
            <T k="hero.description" />
          </p>
        </div>
        <div className="rounded bg-white/95 px-5 py-4 shadow-lg">
          <SearchForm />
        </div>
      </div>
    </section>
  )
}
