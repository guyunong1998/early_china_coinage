'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { DEMO_VISUALIZATIONS, demoHref } from '@/lib/demo-visualizations'

/**
 * Homepage "Map Visualizations" section — a one-at-a-time carousel of
 * pre-built demo links (screenshot + short description) instead of a
 * single static map, so a first-time visitor sees a handful of concrete,
 * already-filtered views rather than a blank map they have to configure
 * themselves. The demo list itself lives in lib/demo-visualizations.ts —
 * edit that file to add/remove/change a slide; this component only renders
 * whatever's there (arrows/dots adapt to however many slides exist).
 *
 * `data-demo-id` on both the dots and the active slide's link is read by
 * scripts/capture-demo-screenshots.mjs (click each dot in turn, then read
 * the now-active slide's href) — keep those attributes if you touch the
 * markup below.
 */
export function DemoVisualizationsCarousel() {
  const { lang } = useLanguage()
  const [index, setIndex] = useState(0)
  const lastWheelAt = useRef(0)

  const count = DEMO_VISUALIZATIONS.length
  const demo = DEMO_VISUALIZATIONS[index]
  const title = lang === 'zh' ? demo.title.zh : demo.title.en
  const description = lang === 'zh' ? demo.description.zh : demo.description.en
  const via = lang === 'zh' ? demo.via.zh : demo.via.en

  function go(delta: number) {
    setIndex((i) => (i + delta + count) % count)
  }

  // A single trackpad swipe or mouse-wheel tick fires many wheel events —
  // debounce so one gesture moves exactly one slide, and prevent the
  // default so it doesn't also scroll the page out from under the user
  // while they're navigating the carousel.
  function handleWheel(e: React.WheelEvent) {
    if (count <= 1) return
    e.preventDefault()
    const now = Date.now()
    if (now - lastWheelAt.current < 500) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 10) return
    lastWheelAt.current = now
    go(delta > 0 ? 1 : -1)
  }

  return (
    <div className="panel-nav-card overflow-hidden lg:grid lg:grid-cols-3">
      <div className="panel-nav-card-inner m-4 flex flex-col justify-center gap-0 p-4 lg:col-span-1">
        <h2 className="font-serif text-xl font-semibold text-brand">
          <T k="navcards.map.label" />
        </h2>
        <p className="text-sm leading-6 text-gray-600">
          <T k="home.demos.desc" />
        </p>
        <Link
          href="/visualizations"
          className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
        >
          <T k="home.mapSection.title" /> →
        </Link>
      </div>

      <div className="lg:col-span-2 p-4">
        <div className="relative" onWheel={handleWheel}>
          {/* The sliding "track": every slide sits side by side (width =
              count × 100%) inside this fixed 16:9, overflow-hidden viewport,
              and the whole track shifts by -index × 100% — a CSS transition
              on transform gives the slide-to-slide motion. Every demo image
              is cropped to this same 16:9 ratio ahead of time
              (scripts/crop-demo-images.mjs — capture-demo-screenshots.mjs
              runs it automatically; re-run it by hand after manually
              replacing an image) — object-cover here is a safety net for a
              mismatched source, not the thing doing the cropping, so the
              frame never resizes switching slides. */}
          <div className="relative aspect-video w-full overflow-hidden rounded border border-brand/15 bg-gray-100">
            <div
              className="flex h-full transition-transform duration-500 ease-in-out"
              style={{ width: `${count * 100}%`, transform: `translateX(-${index * (100 / count)}%)` }}
            >
              {DEMO_VISUALIZATIONS.map((d, i) => {
                const slideTitle = lang === 'zh' ? d.title.zh : d.title.en
                return (
                  <Link
                    key={d.id}
                    href={demoHref(d)}
                    // Only the active slide is tagged — capture-demo-
                    // screenshots.mjs reads exactly one `a[data-demo-id]` per
                    // click, so every off-screen slide must stay untagged.
                    data-demo-id={i === index ? demo.id : undefined}
                    aria-hidden={i !== index}
                    tabIndex={i === index ? 0 : -1}
                    className="group relative block h-full shrink-0"
                    style={{ width: `${100 / count}%` }}
                  >
                    <Image
                      src={d.image}
                      alt={slideTitle}
                      fill
                      sizes="(min-width: 1024px) 66vw, 100vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  </Link>
                )
              })}
            </div>
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg font-semibold text-brand shadow-lg ring-1 ring-black/10 transition hover:bg-brand-light"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg font-semibold text-brand shadow-lg ring-1 ring-black/10 transition hover:bg-brand-light"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* Title stays truncated to one line, description+via clamped to
            two — that combination plus the min-h fixes the block's total
            height regardless of how long a given slide's text runs, so the
            panel never resizes switching slides (the same guarantee the old
            single-line truncate gave, now that description is a full
            sentence instead of a short fragment). key={demo.id} re-triggers
            the fade-in animation on every slide change. */}
        <div key={demo.id} className="mt-3 min-h-[4.5rem] text-sm animate-[fade-in_0.4s_ease-in-out]">
          <p className="truncate font-serif font-semibold text-gray-900">{title}</p>
          <p className="mt-0.5 line-clamp-2 leading-5 text-gray-600">
            {description} <span className="text-gray-400">({via})</span>
          </p>
        </div>

        {count > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {DEMO_VISUALIZATIONS.map((d, i) => (
              <button
                key={d.id}
                type="button"
                data-demo-id={d.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-5 bg-brand' : 'w-2 bg-brand/25 hover:bg-brand/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
