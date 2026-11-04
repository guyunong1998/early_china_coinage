import Image from 'next/image'
import Link from 'next/link'

export type Level2TypeShowcaseItem = {
  slug: string
  label_zh: string
  label_en: string
  obverseSrc: string
}

/** Home page teaser for /coin-types — a real obverse photo (never a
 * silhouette) for each top-level coin category, linked through to that
 * category's page. Hardcoded in app/page.tsx so the home page needs no
 * database query. */
export function Level2TypeShowcase({ items }: { items: Level2TypeShowcaseItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {items.map(({ slug, label_zh, label_en, obverseSrc }) => (
        <Link
          key={slug}
          href={`/coin-types/${slug}`}
          className="group flex flex-col items-center border border-gray-200 bg-white p-2 transition hover:border-brand"
        >
          <div className="relative h-24 w-full overflow-hidden bg-white">
            <Image
              src={obverseSrc}
              alt={`${label_zh} (${label_en})`}
              width={200}
              height={200}
              className="h-full w-full object-contain transition group-hover:opacity-90"
            />
          </div>
          <span className="mt-2 text-center text-xs font-semibold text-gray-700 group-hover:text-brand">
            {label_zh} <span className="muted-italic">({label_en})</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
