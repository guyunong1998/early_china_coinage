import Image from 'next/image'
import Link from 'next/link'
import { T } from '@/components/i18n/T'
import { MouldTag } from '@/components/coin-types/MouldTag'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { stateTagColor } from '@/lib/state-colors'
import type { CoinTypeCounts, CoinTypeNode } from '@/lib/coin-type-catalog'
import type { CoinTypeImagePaths } from '@/lib/coin-images'

/** One typology node (L1–L4) as a card — mirrors MintListClient's card
 * shape/CSS (`panel`, tag styling, hover reveal) so the two list pages read
 * as one system. */
export function CoinTypeCard({
  node,
  counts,
  images,
  isMould = false,
}: {
  node: CoinTypeNode
  counts?: CoinTypeCounts
  images?: CoinTypeImagePaths
  isMould?: boolean
}) {
  const panes = [
    images?.obverseSrc ? { src: images.obverseSrc, key: 'obv' } : null,
    images?.reverseSrc ? { src: images.reverseSrc, key: 'rev' } : null,
  ].filter((p): p is { src: string; key: string } => p !== null)

  return (
    <Link href={`/coin-types/${node.slug}`} className="panel group flex flex-col p-5">
      {panes.length > 0 ? (
        <div className={`grid gap-1.5 ${panes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {panes.map((pane) => (
            <div
              key={pane.key}
              className="relative h-28 w-full overflow-hidden rounded border border-gray-200 bg-white"
            >
              <Image
                src={pane.src}
                alt={node.label_en}
                width={300}
                height={200}
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : (
        <ImagePlaceholder label={<T k="coinTypeDetail.imagePlaceholder" />} className="h-28 w-full rounded" />
      )}

      <div className="mt-3 flex items-start justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-gray-900 group-hover:text-brand">
          {node.label_zh} <span className="text-sm font-normal text-gray-500">({node.label_en})</span>
        </h2>
        <MouldTag isMould={isMould} />
      </div>

      {counts && counts.coinCount > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          <T k="coinTypeList.coinsInSites" vars={{ coins: counts.coinCount, sites: counts.siteCount }} />
        </p>
      )}

      {node.parents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {node.parents.map((p) => (
            <span
              key={p.slug}
              className="rounded border border-brand/20 bg-brand-light px-2 py-0.5 text-xs text-brand"
            >
              {p.label_zh}
            </span>
          ))}
        </div>
      )}

      {node.states.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {node.states.map((s) => (
            <span
              key={s.state_zh}
              className={`rounded px-2 py-0.5 text-xs font-semibold ${stateTagColor(s.state_en)}`}
            >
              {s.state_zh}
            </span>
          ))}
        </div>
      )}

      <span className="mt-4 text-xs text-brand opacity-0 transition group-hover:opacity-100">
        <T k="mintList.viewDetails" />
      </span>
    </Link>
  )
}
