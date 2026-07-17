import type { ReactNode } from 'react'

/** Visual stand-in for an image that hasn't been sourced yet — a dashed
 * bordered box with a caption. Swap the parent's markup for a real <Image>
 * once the actual asset exists; this component carries no data of its own. */
export function ImagePlaceholder({
  label,
  className = 'h-40 w-full',
}: {
  label?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-center border border-dashed border-brand/30 bg-brand-light/40 ${className}`}
    >
      <span className="px-2 text-center text-xs text-gray-400">{label}</span>
    </div>
  )
}
