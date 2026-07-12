'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { MintImage } from '@/lib/mint-towns'

export function MintImageGallery({ images }: { images: MintImage[] }) {
  const [lightbox, setLightbox] = useState<MintImage | null>(null)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img, i) => (
          <figure key={i} className="group cursor-zoom-in" onClick={() => setLightbox(img)}>
            <div className="relative overflow-hidden border border-gray-200 bg-gray-50">
              <Image
                src={img.src}
                alt={img.caption ?? 'Site map'}
                width={400}
                height={300}
                className="h-56 w-full object-contain transition group-hover:opacity-90"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                <span className="rounded bg-black/50 px-3 py-1 text-xs text-white">
                  Click to enlarge
                </span>
              </div>
            </div>
            {(img.caption || img.credit) && (
              <figcaption className="mt-1.5 text-xs text-gray-500">
                {img.caption && <span>{img.caption}</span>}
                {img.credit && (
                  <span className="ml-2 italic text-gray-400">{img.credit}</span>
                )}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* Lightbox */}
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
              alt={lightbox.caption ?? 'Site map'}
              width={900}
              height={700}
              className="max-h-[80vh] w-auto object-contain"
            />
            {(lightbox.caption || lightbox.credit) && (
              <p className="mt-2 px-2 text-sm text-gray-600">
                {lightbox.caption}
                {lightbox.credit && (
                  <span className="ml-2 italic text-gray-400">{lightbox.credit}</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
