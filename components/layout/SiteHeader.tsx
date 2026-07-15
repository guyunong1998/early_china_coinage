import Link from 'next/link'
import { T } from '@/components/i18n/T'
import { LanguageToggle } from '@/components/i18n/LanguageToggle'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
            钱
          </div>
          <div>
            <p className="font-serif text-lg font-semibold tracking-wide text-brand">
              Early Chinese Coin Finds
            </p>
            <p className="text-xs text-gray-500">先秦至汉初钱币出土数据库</p>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-700 md:flex">
            <Link href="/mints" className="hover:text-brand">
              <T k="nav.mints" />
            </Link>
            <Link href="/visualizations" className="hover:text-brand">
              <T k="nav.map" />
            </Link>
            <Link href="/heatmap" className="hover:text-brand">
              <T k="nav.spadeHeatmap" />
            </Link>
            <Link href="/search" className="hover:text-brand">
              <T k="nav.search" />
            </Link>
            <Link href="/about" className="hover:text-brand">
              <T k="nav.about" />
            </Link>
          </nav>
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
