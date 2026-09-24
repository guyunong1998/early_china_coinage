import Image from 'next/image'
import Link from 'next/link'
import { T } from '@/components/i18n/T'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import type { CoinTypeNode } from '@/lib/coin-type-catalog'

/**
 * Shown in place of a general-category node's own image (see
 * app/coin-types/[slug]/page.tsx): a node with no photographed specimen of
 * its own (node.imgAccNum is null) has nothing but a generic silhouette to
 * show for itself, so instead we show the obverse photo of each of its
 * direct subtypes, linked through to that subtype's page.
 */
export function SubtypeImageGrid({ subtypes }: { subtypes: CoinTypeNode[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {subtypes.map((subtype) => {
        const { obverseSrc } = getCoinTypeImagePaths(subtype.imgAccNum, subtype.slug)
        return (
          <Link
            key={subtype.slug}
            href={`/coin-types/${subtype.slug}`}
            className="group flex flex-col items-center border border-gray-200 bg-white p-2 transition hover:border-brand"
          >
            <div className="relative h-28 w-full overflow-hidden bg-white">
              {obverseSrc ? (
                <Image
                  src={obverseSrc}
                  alt={`${subtype.label_zh} (${subtype.label_en})`}
                  width={200}
                  height={200}
                  className="h-full w-full object-contain transition group-hover:opacity-90"
                />
              ) : (
                <ImagePlaceholder label={<T k="coinTypeDetail.imagePlaceholder" />} className="h-full w-full" />
              )}
            </div>
            <span className="mt-2 text-center text-xs font-semibold text-gray-700 group-hover:text-brand">
              {subtype.label_zh} <span className="muted-italic">({subtype.label_en})</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
