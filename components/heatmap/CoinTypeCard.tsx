import Image from 'next/image'
import { T } from '@/components/i18n/T'
import { displayValue } from '@/lib/format'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { CoinType } from '@/lib/types'
import type { CoinTypeImagePaths } from '@/lib/coin-images'

export function CoinTypeCard({
  coinType,
  images,
}: {
  coinType: CoinType
  images: CoinTypeImagePaths
}) {
  const title = [coinType.major_type_zh, coinType.minor_type_zh, coinType.inscription]
    .filter(Boolean)
    .join(' · ')
  const titleEn = [coinType.major_type_en, coinType.minor_type_en, coinType.inscription_en]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col overflow-hidden border border-brand/20 bg-white">
      <div className="border-b border-brand/10 px-4 py-3">
        <h3 className="font-semibold text-gray-900">{displayValue(title)}</h3>
        {titleEn && <p className="text-xs italic text-gray-500">{titleEn}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        <CoinImageSlot labelKey="heatmap.obverse" src={images.obverseSrc} />
        <CoinImageSlot labelKey="heatmap.reverse" src={images.reverseSrc} />
      </div>

      <p className="flex-1 px-4 pb-4 text-sm text-gray-600">
        {displayValue(coinType.description_zh ?? coinType.description_en)}
      </p>
    </div>
  )
}

function CoinImageSlot({ labelKey, src }: { labelKey: DictionaryKey; src: string | null }) {
  if (src) {
    return (
      <div className="relative aspect-square overflow-hidden border border-gray-200 bg-gray-50">
        <Image src={src} alt={labelKey} fill className="object-contain" />
      </div>
    )
  }

  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-gray-300 bg-gray-50 text-gray-400">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5.5" />
      </svg>
      <span className="text-[11px] uppercase tracking-wide">
        <T k={labelKey} />
      </span>
    </div>
  )
}
