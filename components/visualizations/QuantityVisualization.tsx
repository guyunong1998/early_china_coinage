'use client'

import { useState, type ReactNode } from 'react'
import { PointedSpadeHeatmap } from '@/components/heatmap/PointedSpadeHeatmap'
import type { AnsSpadeKind, HeatmapSource } from '@/components/heatmap/HeatmapPanel'
import { T } from '@/components/i18n/T'
import type { AnsMintStats } from '@/lib/ans-spade-data'
import type { PointedSpadeMintStat } from '@/lib/pointed-spade-data'

const ANS_KIND_TABS: { id: AnsSpadeKind; labelKey: 'visualizations.ans.pointed' | 'visualizations.ans.square' }[] = [
  { id: 'pointed', labelKey: 'visualizations.ans.pointed' },
  { id: 'square', labelKey: 'visualizations.ans.square' },
]

/** Quantity tab of the map visualizations page: the mint production heatmap
 * map only — no "Coins by mint" table or "Data sources" card (unlike the
 * standalone /heatmap page, which keeps both — see HeatmapPanel.tsx). */
export function QuantityVisualization({
  database,
  ansPointed,
  ansSquare,
  tabs,
}: {
  database: { mapped: PointedSpadeMintStat[]; unmapped: PointedSpadeMintStat[] }
  ansPointed: AnsMintStats
  ansSquare: AnsMintStats
  tabs: ReactNode
}) {
  const [source, setSource] = useState<HeatmapSource>('database')
  const [ansKind, setAnsKind] = useState<AnsSpadeKind>('pointed')

  const ans = ansKind === 'pointed' ? ansPointed : ansSquare
  const active = source === 'database' ? database : ans

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col bg-white lg:flex-row min-[1440px]:min-h-0 min-[1440px]:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-b border-brand/20 lg:w-[19.5rem] lg:border-b-0 lg:border-r xl:w-[22rem]">
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5 sm:px-3.5">
          {tabs}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              <T k="visualizations.data.label" />
            </span>
            {(['database', 'ans'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`px-2 py-0.5 text-[11px] font-semibold border transition ${
                  source === s
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
                }`}
              >
                <T k={s === 'database' ? 'visualizations.data.database' : 'visualizations.data.ans'} />
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="relative flex-1 overflow-y-auto p-4">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            <span>
              <T k="visualizations.mintHeatmapTitle" />
            </span>
            {source === 'ans' && (
              <div className="flex flex-wrap gap-1">
                {ANS_KIND_TABS.map((tab) => {
                  const selected = tab.id === ansKind
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAnsKind(tab.id)}
                      className={`rounded border px-2.5 py-1 text-xs font-semibold normal-case tracking-normal transition ${
                        selected
                          ? 'border-white bg-white text-brand'
                          : 'border-white/40 bg-transparent text-white hover:border-white hover:bg-white/10'
                      }`}
                    >
                      <T k={tab.labelKey} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="p-4">
            {active.mapped.length > 0 ? (
              <PointedSpadeHeatmap
                key={source === 'ans' ? `ans-${ansKind}` : 'database'}
                mints={active.mapped}
                source={source}
              />
            ) : (
              <p className="text-sm text-gray-500">
                <T k="visualizations.noMappedMints" />
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
