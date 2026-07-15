import { SearchForm } from '@/components/ui/SearchForm'
import { T } from '@/components/i18n/T'
import { getDatabaseStats } from '@/lib/queries'
import { formatNumber } from '@/lib/format'

export async function HeroBanner() {
  const stats = await getDatabaseStats()
  const statsVars = {
    coins: formatNumber(stats.totalCoins),
    sites: formatNumber(stats.siteCount),
    finds: formatNumber(stats.findCount),
  }

  return (
    <section
      className="relative overflow-hidden text-white hero-banner"
    >
      {/* Decorative coins illustration — desktop only, right-aligned, tinted
          by the same left-to-right brand gradient as the section background,
          just reversed (right to left), so the two read as one continuous
          gradient sweep. */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <img
          src="/images/hero-coins.svg"
          alt=""
          className="absolute right-0 top-0 h-full w-auto max-w-none"
        />
        <div
          className="absolute inset-0 hero-banner__overlay"
        />
      </div>

      <div className="relative mx-auto grid max-w-5xl gap-4 px-4 py-12">
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
        <div className="px-10 py-4">
          <SearchForm />
        </div>
        <p className="text-sm text-white/90">
          <T k={stats.findCount > 0 ? 'stats.summaryWithFinds' : 'stats.summary'} vars={statsVars} />
        </p>
      </div>
    </section>
  )
}
