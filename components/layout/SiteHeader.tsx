'use client'

import Link from 'next/link'
import { T } from '@/components/i18n/T'
import { LanguageToggle } from '@/components/i18n/LanguageToggle'
import { MobileNav } from '@/components/layout/MobileNav'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function SiteHeader() {
  const { t } = useLanguage()
  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- plain
              img keeps this a static, non-Next-Image-optimized asset load
              for a small SVG whose intrinsic aspect ratio (tall, spade-coin
              shaped) should drive its own width, not a fixed square box. */}
          <img src="/coin.svg" alt="" className="h-10 w-auto shrink-0" />
          <div>
            <p className="title-en">
              Early Chinese Coin Finds
            </p>
            <p className="title-zh">
              先秦至汉初钱币出土数据库
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-1 text-sm font-medium text-gray-700 lg:flex">
            <Link href="/mints" className="rounded px-2.5 py-1.5 transition hover:bg-brand-light hover:text-brand">
              <T k="nav.mints" />
            </Link>
            <Link href="/coin-types" className="rounded px-2.5 py-1.5 transition hover:bg-brand-light hover:text-brand">
              <T k="nav.coinTypes" />
            </Link>
            <Link href="/visualizations" className="rounded px-2.5 py-1.5 transition hover:bg-brand-light hover:text-brand">
              <T k="nav.map" />
            </Link>
            <Link
              href="/museum-collections"
              title={t('nav.spadeHeatmapHint')}
              className="rounded px-2.5 py-1.5 transition hover:bg-brand-light hover:text-brand"
            >
              <T k="nav.spadeHeatmap" />
            </Link>
            <Link href="/search" className="rounded px-2.5 py-1.5 transition hover:bg-brand-light hover:text-brand">
              <T k="nav.search" />
            </Link>
            <Link href="/about" className="rounded px-2.5 py-1.5 transition hover:bg-brand-light hover:text-brand">
              <T k="nav.about" />
            </Link>
          </nav>
          <MobileNav />
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
