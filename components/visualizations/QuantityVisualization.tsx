'use client'

/**
 * Quantity tab of the map visualizations page: a sidebar ("Visualize by"
 * tabs, a database/ANS-catalogue toggle, a pointed/square-foot category
 * dropdown) alongside the mint production heatmap map (PointedSpadeHeatmap,
 * a pure map — this component supplies its own caption below it) only — no
 * title, no bordered container, no "Coins by mint" table or "Data sources"
 * card (unlike the standalone /heatmap page, which keeps all of that — see
 * components/heatmap/HeatmapPanel.tsx). Styled to match the Coin Type / Mint
 * tabs' sidebar + unbordered map layout (FindSpotsVisualization.tsx).
 *
 * Used by: app/visualizations/quantity/page.tsx.
 */

import { useState } from 'react'
import { PointedSpadeHeatmap } from '@/components/map/PointedSpadeHeatmap'
import type { AnsSpadeKind, HeatmapSource, PointedSpadeMintStat } from '@/lib/pointed-spade-data'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { VisualizationTabs } from '@/components/visualizations/VisualizationTabs'
import type { AnsMintStats } from '@/lib/ans-spade-data'

export function QuantityVisualization({
  database,
  ansPointed,
  ansSquare,
}: {
  database: { mapped: PointedSpadeMintStat[]; unmapped: PointedSpadeMintStat[] }
  ansPointed: AnsMintStats
  ansSquare: AnsMintStats
}) {
  const { t } = useLanguage()
  const [source, setSource] = useState<HeatmapSource>('database')
  const [ansKind, setAnsKind] = useState<AnsSpadeKind>('pointed')

  const ans = ansKind === 'pointed' ? ansPointed : ansSquare
  const active = source === 'database' ? database : ans

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col bg-white lg:flex-row min-[1440px]:min-h-0 min-[1440px]:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-b border-brand/20 lg:w-[19.5rem] lg:border-b-0 lg:border-r xl:w-[22rem]">
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5 sm:px-3.5">
          <div key="tabs">
            <VisualizationTabs />
          </div>

          <div key="data-toggle" className="flex flex-wrap items-center gap-1.5">
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

          {source === 'ans' && (
            <label key="ans-category" className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                <T k="visualizations.ans.category" />
              </span>
              <select
                value={ansKind}
                onChange={(e) => setAnsKind(e.target.value as AnsSpadeKind)}
                className="w-full rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="pointed">{t('visualizations.ans.pointed')}</option>
                <option value="square">{t('visualizations.ans.square')}</option>
              </select>
            </label>
          )}

          <p key="caption" className="text-[11px] leading-snug text-gray-500">
            <T
              k={
                source === 'database'
                  ? 'visualizations.mintHeatmapCaption.database'
                  : 'visualizations.mintHeatmapCaption.ans'
              }
            />
          </p>
        </div>
      </aside>

      <div className="relative flex-1 overflow-y-auto p-4">
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
  )
}
