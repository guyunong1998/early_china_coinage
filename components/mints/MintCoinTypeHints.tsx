'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ClickHint } from '@/components/ui/ClickHint'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { T } from '@/components/i18n/T'

export type MintCoinTypeHint = {
  zh: string
  en: string | null
  /** Null when this label couldn't be matched to a browsable coin-type
   * catalog node — rendered as plain (non-clickable) text in that case. */
  slug: string | null
  obverseSrc: string | null
  reverseSrc: string | null
}

function CoinTypeHintPanel({ item }: { item: MintCoinTypeHint }) {
  return (
    <div className="w-44">
      {item.obverseSrc ? (
        <div className="relative h-24 w-full overflow-hidden rounded border border-gray-200 bg-white">
          <Image src={item.obverseSrc} alt={item.zh} fill sizes="176px" className="object-contain" />
        </div>
      ) : (
        <ImagePlaceholder label={<T k="coinTypeDetail.imagePlaceholder" />} className="h-24 w-full rounded" />
      )}
      {item.slug && (
        <Link
          href={`/coin-types/${item.slug}`}
          className="mt-2 block text-xs font-semibold text-brand hover:underline"
        >
          <T k="mintDetail.coinTypeHint.viewMore" /> →
        </Link>
      )}
    </div>
  )
}

/** One coin-type label as a dotted-underline click hint — on click, shows
 * that type's obverse photo (or the generic group silhouette when the label
 * covers several sub-types, same fallback CoinTypeCard uses on /coin-types)
 * plus a link to its full catalog entry. Falls back to plain text when the
 * label couldn't be matched to a catalog node. */
export function MintCoinTypeHints({ items }: { items: MintCoinTypeHint[] }) {
  if (items.length === 0) return <>—</>
  return (
    <span className="flex flex-wrap items-baseline gap-x-1">
      {items.map((item, i) => {
        const label = item.en ? `${item.zh} (${item.en})` : item.zh
        return (
          <span key={`${item.slug ?? item.zh}-${i}`}>
            {item.slug ? (
              <ClickHint
                hint={<CoinTypeHintPanel item={item} />}
                panelClassName="w-44"
                className="cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2"
              >
                {label}
              </ClickHint>
            ) : (
              <span>{label}</span>
            )}
            {i < items.length - 1 && '、'}
          </span>
        )
      })}
    </span>
  )
}
