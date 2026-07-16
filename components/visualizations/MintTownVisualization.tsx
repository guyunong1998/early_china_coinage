'use client'

/**
 * Mint Town tab of the map visualizations page: the full-bleed mint
 * production heatmap map (PointedSpadeHeatmap, a pure map) with the
 * database/ANS-catalogue toggle and pointed/square-foot picker inside the
 * shared MapVisualizationOverlay.
 *
 * Used by: app/visualizations/mint-town/page.tsx.
 */

import { useState } from 'react'
import { PointedSpadeHeatmap } from '@/components/map/PointedSpadeHeatmap'
import { MapVisualizationOverlay } from '@/components/visualizations/MapVisualizationOverlay'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { AnsSpadeKind, HeatmapSource, PointedSpadeMintStat } from '@/lib/pointed-spade-data'
import type { AnsMintStats } from '@/lib/ans-spade-data'

export function MintTownVisualization({
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
    <div className="absolute inset-0">
      <PointedSpadeHeatmap
        key={source === 'ans' ? `ans-${ansKind}` : 'database'}
        mints={active.mapped}
        source={source}
        fill
      />

      <MapVisualizationOverlay>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              <T k="visualizations.data.label" />
            </span>
            {(['database', 'ans'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`rounded border px-2.5 py-1 text-sm font-semibold transition ${
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
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-gray-700">
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

          <p className="text-sm leading-snug text-gray-700">
            <T
              k={
                source === 'database'
                  ? 'visualizations.mintHeatmapCaption.database'
                  : 'visualizations.mintHeatmapCaption.ans'
              }
            />
          </p>

          {active.mapped.length === 0 && (
            <p className="text-sm text-gray-700">
              <T k="visualizations.noMappedMints" />
            </p>
          )}
        </div>
      </MapVisualizationOverlay>
    </div>
  )
}
