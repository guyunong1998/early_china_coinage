import Link from 'next/link'
import { T } from '@/components/i18n/T'

type MapOverviewCardProps = {
  /** Where the left-third "View More Map Visualizations" link goes — the
   * dedicated visualization page most relevant to the host page (Mint Town
   * for /mints, the general hub for /coin-types). */
  href: string
  /** Right-two-thirds preview — a live map on /mints, a static demo
   * screenshot on /coin-types. */
  children: React.ReactNode
}

/** The "Overview map" nav-card shared by /mints and /coin-types: a
 * left-third title/description/link over a right-two-thirds map preview. */
export function MapOverviewCard({ href, children }: MapOverviewCardProps) {
  return (
    <div className="mt-6 panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
      <div className="panel-nav-card-inner m-4 flex flex-col justify-center gap-0 p-4 lg:col-span-1">
        <h2 className="font-serif text-xl font-semibold text-brand">
          <T k="navcards.map.label" />
        </h2>
        <p className="text-sm leading-6 text-gray-600">
          <T k="navcards.map.desc" />
        </p>
        <Link
          href={href}
          className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
        >
          <T k="home.mapSection.title" /> →
        </Link>
      </div>
      <div className="lg:col-span-2 p-4">{children}</div>
    </div>
  )
}
