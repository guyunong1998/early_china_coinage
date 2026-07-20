'use client'

import Image from 'next/image'
import { useState } from 'react'
import { T } from '@/components/i18n/T'

type Pane = { src: string; labelKey: 'heatmap.obverse' | 'heatmap.reverse' }

export function CoinTypeImages({
  obverseSrc,
  reverseSrc,
  accNum,
}: {
  obverseSrc: string | null
  reverseSrc: string | null
  accNum: string | null
}) {
  const [lightbox, setLightbox] = useState<Pane | null>(null)

  const panes: Pane[] = [
    obverseSrc ? { src: obverseSrc, labelKey: 'heatmap.obverse' as const } : null,
    reverseSrc ? { src: reverseSrc, labelKey: 'heatmap.reverse' as const } : null,
  ].filter((p): p is Pane => p !== null)

  if (panes.length === 0) return null

  return (
    <>
      <div className={`mt-4 grid gap-3 ${panes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {panes.map((pane) => (
          <figure
            key={pane.labelKey}
            className="group cursor-zoom-in border border-gray-200 bg-white"
            onClick={() => setLightbox(pane)}
          >
            <div className="relative h-56 w-full overflow-hidden bg-white">
              <Image
                src={pane.src}
                alt={pane.labelKey}
                width={400}
                height={400}
                className="h-full w-full object-contain transition group-hover:opacity-90"
              />
            </div>
            <figcaption className="border-t border-gray-200 bg-white px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
              {accNum && <span className="text-gray-400">ANS {accNum} · </span>}
              <T k={pane.labelKey} />
            </figcaption>
          </figure>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-auto bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black"
            >
              ✕ Close
            </button>
            <Image
              src={lightbox.src}
              alt={lightbox.labelKey}
              width={900}
              height={900}
              className="max-h-[80vh] w-auto object-contain"
            />
            <p className="mt-2 px-2 text-center text-xs uppercase tracking-wide text-gray-500">
              {accNum && <span className="text-gray-400">ANS {accNum} · </span>}
              <T k={lightbox.labelKey} />
            </p>
          </div>
        </div>
      )}
    </>
  )
}
