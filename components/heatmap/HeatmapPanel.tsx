'use client'

/**
 * Standalone old-ans-spades page's full section: the mint production
 * heatmap map (PointedSpadeHeatmap, a pure map — this component supplies its
 * own caption text below it) for the legacy ANS catalogue, a "Coins by mint"
 * table, and a "Data sources" card.
 *
 * Used by: app/old-ans-spades/page.tsx only. Kept intentionally separate
 * from (and untouched by) the map visualizations page's Quantity tab, which
 * reuses PointedSpadeHeatmap directly without the table/sources — see
 * components/visualizations/QuantityVisualization.tsx.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PointedSpadeHeatmap } from '@/components/map/PointedSpadeHeatmap'
import { DataCard } from '@/components/ui/DataCard'
import { formatNumber } from '@/lib/format'
import type { AnsMintStats } from '@/lib/ans-spade-data'
import type { AnsSpadeKind } from '@/lib/pointed-spade-data'

type HeatmapPanelProps = {
  ansPointed: AnsMintStats
  ansSquare: AnsMintStats
}

const ANS_KIND_TABS: { id: AnsSpadeKind; label: string }[] = [
  { id: 'pointed', label: 'Pointed-foot (尖足布)' },
  { id: 'square', label: 'Square-foot (方足布)' },
]

export function HeatmapPanel({ ansPointed, ansSquare }: HeatmapPanelProps) {
  const [ansKind, setAnsKind] = useState<AnsSpadeKind>('pointed')

  const ans = ansKind === 'pointed' ? ansPointed : ansSquare
  const allMints = useMemo(() => [...ans.mapped, ...ans.unmapped], [ans])

  return (
    <>
      <div className="mb-6 text-sm text-gray-700">
        <p className="max-w-3xl leading-7 text-gray-600">
          Counts from the ANS spade catalogue. Switch between pointed-foot (尖足布) and
          square-foot (方足布) on the same map. Each specimen is assigned to a mint town via its
          inscription and the typology file.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <span>
            <strong>{ans.mapped.length}</strong> mapped mint towns
          </span>
          <span>
            <strong>{formatNumber(ans.totalSpecimens)}</strong> ANS specimens
          </span>
          {ans.unmatchedInscriptions.length > 0 && (
            <span className="text-xs text-amber-700">
              {ans.unmatchedInscriptions.length} inscription(s) without mapped coordinates
            </span>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
          <span>Mint Production Heatmap</span>
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
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="space-y-2 p-4">
          {ans.mapped.length > 0 ? (
            <>
              <PointedSpadeHeatmap key={`ans-${ansKind}`} mints={ans.mapped} source="ans" />
              <p className="text-xs text-gray-500">
                Circle size and intensity reflect the number of ANS catalogue specimens for each
                mint town. Only mints with mapped coordinates are shown.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No mapped mint towns for this data source.</p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <DataCard title="Coins by mint">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4">Mint</th>
                  <th className="py-2 pr-4">Specimens</th>
                  <th className="py-2">Inscriptions</th>
                </tr>
              </thead>
              <tbody>
                {allMints.map((mint) => (
                  <tr key={mint.mint_zh} className="border-b border-gray-50">
                    <td className="py-2 pr-4">
                      {mint.mint_code ? (
                        <Link href={`/mints/${mint.mint_code}`} className="text-brand hover:underline">
                          {mint.mint_zh}
                        </Link>
                      ) : (
                        mint.mint_zh
                      )}
                      {mint.mint_en && (
                        <span className="ml-1 text-xs italic text-gray-400">{mint.mint_en}</span>
                      )}
                      {!Number.isFinite(mint.lat) && (
                        <span className="ml-2 text-xs text-amber-600">(no map coords)</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{formatNumber(mint.coinCount)}</td>
                    <td className="py-2 text-xs text-gray-600">
                      {mint.inscriptions.length > 0 ? mint.inscriptions.join('、') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>

        <DataCard title="Data sources">
          {ansKind === 'pointed' ? (
            <ul className="space-y-2 text-sm leading-7 text-gray-700">
              <li>
                <strong>ANS catalogue:</strong> {formatNumber(ansPointed.totalSpecimens)} pointed-foot
                specimens in <code className="text-xs">public/data/ans-pointed-spade.json</code>
              </li>
              <li>
                <strong>Typology:</strong> inscription → mint town (尖足布 only)
              </li>
              <li>
                <strong>Mint towns:</strong> map coordinates from mint town dossiers
              </li>
              {ansPointed.unmatchedInscriptions.length > 0 && (
                <li className="text-xs text-amber-700">
                  Unmapped inscriptions: {ansPointed.unmatchedInscriptions.slice(0, 12).join('、')}
                  {ansPointed.unmatchedInscriptions.length > 12 ? '…' : ''}
                </li>
              )}
            </ul>
          ) : (
            <ul className="space-y-2 text-sm leading-7 text-gray-700">
              <li>
                <strong>ANS catalogue:</strong> {formatNumber(ansSquare.totalSpecimens)} square-foot
                specimens in <code className="text-xs">public/data/ans-square-spade.json</code>
              </li>
              <li>
                <strong>Typology:</strong> obverse inscription → mint town (方足布 only)
              </li>
              <li>
                <strong>Mint towns:</strong> map coordinates from mint town dossiers
              </li>
              {ansSquare.unmatchedInscriptions.length > 0 && (
                <li className="text-xs text-amber-700">
                  Unmapped inscriptions: {ansSquare.unmatchedInscriptions.slice(0, 12).join('、')}
                  {ansSquare.unmatchedInscriptions.length > 12 ? '…' : ''}
                </li>
              )}
            </ul>
          )}
        </DataCard>
      </div>
    </>
  )
}
