import type { CoinTypeImagePaths } from '@/lib/coin-images'

/** Generic "no photo yet" placeholder — a round cash-coin outline with a
 * square hole, the universal shorthand for "a coin" regardless of this
 * particular type's real shape (spade, knife, round, etc). */
function CoinImagePlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex aspect-square w-full items-center justify-center bg-brand-light"
      role="img"
      aria-label={`${label}: no photo available yet`}
    >
      <svg viewBox="0 0 48 48" className="h-2/3 w-2/3 text-brand/40" aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="18" y="18" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  )
}

function CoinImageSlot({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="overflow-hidden rounded border border-brand/20">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="aspect-square w-full object-cover" />
      ) : (
        <CoinImagePlaceholder label={label} />
      )}
      <p className="border-t border-brand/20 bg-white py-1 text-center text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </p>
    </div>
  )
}

export function CoinTypeCard({
  majorTypeZh,
  majorTypeEn,
  minorTypeZh,
  minorTypeEn,
  inscriptionCount,
  images,
}: {
  majorTypeZh: string
  majorTypeEn: string | null
  minorTypeZh: string | null
  minorTypeEn: string | null
  inscriptionCount: number
  images: CoinTypeImagePaths
}) {
  const showMinor = minorTypeZh && minorTypeZh !== majorTypeZh

  return (
    <div className="panel-search-item overflow-hidden">
      <div className="p-4">
        <h3 className="font-serif text-base font-semibold text-brand">
          {majorTypeZh}
          {majorTypeEn && <span className="ml-1.5 text-sm font-normal italic text-gray-400">{majorTypeEn}</span>}
        </h3>
        {showMinor && (
          <p className="text-sm text-gray-600">
            {minorTypeZh}
            {minorTypeEn && <span className="ml-1.5 text-xs italic text-gray-400">{minorTypeEn}</span>}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <CoinImageSlot src={images.obverseSrc} label="Obverse" />
          <CoinImageSlot src={images.reverseSrc} label="Reverse" />
        </div>

        <p className="mt-3 text-xs text-gray-400">
          {inscriptionCount} inscription{inscriptionCount === 1 ? '' : 's'} recorded
        </p>
      </div>
    </div>
  )
}
