import Image from 'next/image'
import Link from 'next/link'
import type { CoinTypeNode } from '@/lib/coin-type-catalog'

export type Level2TypeShowcaseItem = {
  node: CoinTypeNode
  obverseSrc: string
}

/** Home page teaser for /coin-types — a real obverse photo (never a
 * silhouette) for each top-level coin category, linked through to that
 * category's page. Which specimen represents each category is picked at
 * random server-side (see app/page.tsx), so it varies across page loads. */
export function Level2TypeShowcase({ items }: { items: Level2TypeShowcaseItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {items.map(({ node, obverseSrc }) => (
        <Link
          key={node.slug}
          href={`/coin-types/${node.slug}`}
          className="group flex flex-col items-center border border-gray-200 bg-white p-2 transition hover:border-brand"
        >
          <div className="relative h-24 w-full overflow-hidden bg-white">
            <Image
              src={obverseSrc}
              alt={node.label_en}
              width={200}
              height={200}
              className="h-full w-full object-contain transition group-hover:opacity-90"
            />
          </div>
          <span className="mt-2 text-center text-xs font-semibold text-gray-700 group-hover:text-brand">
            {node.label_zh} <span className="italic text-gray-400">({node.label_en})</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
