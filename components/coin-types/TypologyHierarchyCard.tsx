'use client'

import { useState } from 'react'
import { FullTypologyTree } from '@/components/coin-types/TypologyTree'
import { TypologyViewer, type TypologyViewerManifest } from '@/components/coin-types/TypologyViewer'
import { LabelHint } from '@/components/ui/LabelHint'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { CoinTypeNode } from '@/lib/coin-type-catalog'

type View = 'visual' | 'list'

/**
 * The coin-types index page's single "Typology Hierarchy" card — toggles
 * between the pannable/zoomable poster diagram (TypologyViewer) and the
 * plain nested tree (FullTypologyTree). Same underlying hierarchy, two ways
 * to browse it, so it's one card instead of two separate ones competing for
 * space on the page.
 */
export function TypologyHierarchyCard({
  nodes,
  src,
  manifest,
}: {
  nodes: CoinTypeNode[]
  src: string
  manifest: TypologyViewerManifest
}) {
  const { t } = useLanguage()
  const [view, setView] = useState<View>('visual')

  return (
    <section className="panel mt-8 overflow-hidden">
      <div className="panel-header flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide">
        <LabelHint labelKey="coinTypeDetail.hierarchy" hintKey="coinTypeDetail.hierarchyHint" />
        <div className="flex gap-1.5 normal-case">
          {(['visual', 'list'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${
                view === option
                  ? 'border-white bg-white text-brand'
                  : 'border-white/40 bg-transparent text-white hover:bg-white/10'
              }`}
            >
              {t(`coinTypeDetail.hierarchy.${option}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body p-5">
        {view === 'visual' ? (
          <TypologyViewer src={src} manifest={manifest} />
        ) : (
          <div className="scrollbar max-h-[460px] overflow-y-auto pl-3">
            <FullTypologyTree nodes={nodes} />
          </div>
        )}
      </div>
    </section>
  )
}
