'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PointedSpadeHeatmap } from '@/components/heatmap/PointedSpadeHeatmap'
import { DataCard } from '@/components/ui/DataCard'
import { formatNumber } from '@/lib/format'
import type { AnsMintStats } from '@/lib/ans-spade-data'
import type { PointedSpadeMintStat } from '@/lib/pointed-spade-data'

export type HeatmapSource = 'database' | 'ans-pointed' | 'ans-square'

type HeatmapPanelProps = {
  database: {
    mapped: PointedSpadeMintStat[]
    unmapped: PointedSpadeMintStat[]
    totalCoins: number
    totalFinds: number
  }
  ansPointed: AnsMintStats
  ansSquare: AnsMintStats
}

const SOURCE_TABS: { id: HeatmapSource; label: string }[] = [
  { id: 'database', label: 'Database finds' },
  { id: 'ans-pointed', label: 'ANS pointed-foot (尖足布)' },
  { id: 'ans-square', label: 'ANS square-foot (方足布)' },
]

export function HeatmapPanel({ database, ansPointed, ansSquare }: HeatmapPanelProps) {
  const [source, setSource] = useState<HeatmapSource>('database')

  const active =
    source === 'database' ? database : source === 'ans-pointed' ? ansPointed : ansSquare
  const isAns = source !== 'database'
  const ans = source === 'ans-pointed' ? ansPointed : ansSquare
  const allMints = useMemo(() => [...active.mapped, ...active.unmapped], [active])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SOURCE_TABS.map((tab) => {
          const selected = tab.id === source
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSource(tab.id)}
              className={`rounded border px-3 py-1.5 text-sm transition ${
                selected
                  ? 'border-brand bg-brand text-white'
                  : 'border-brand/30 bg-white text-brand hover:bg-brand-light'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="mb-6 text-sm text-gray-700">
        {source === 'database' ? (
          <>
            <p className="max-w-3xl leading-7 text-gray-600">
              Counts from archaeological find records in the database, grouped by mint town and
              cross-referenced with typology and mint dossiers.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <span>
                <strong>{database.mapped.length}</strong> mapped mint towns
              </span>
              <span>
                <strong>{formatNumber(database.totalCoins)}</strong> coins counted
              </span>
              <span>
                <strong>{formatNumber(database.totalFinds)}</strong> find records
              </span>
            </div>
          </>
        ) : source === 'ans-pointed' ? (
          <>
            <p className="max-w-3xl leading-7 text-gray-600">
              Counts from the ANS pointed-foot spade catalogue (
              <code className="text-xs">ANS_Pointed_foot_spade.xlsx</code>,{' '}
              {formatNumber(ansPointed.totalSpecimens)} specimens). Each specimen is assigned to a
              mint town via its inscription and the typology file (尖足布).
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <span>
                <strong>{ansPointed.mapped.length}</strong> mapped mint towns
              </span>
              <span>
                <strong>{formatNumber(ansPointed.totalSpecimens)}</strong> ANS specimens
              </span>
              {ansPointed.unmatchedInscriptions.length > 0 && (
                <span className="text-xs text-amber-700">
                  {ansPointed.unmatchedInscriptions.length} inscription(s) without mapped coordinates
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="max-w-3xl leading-7 text-gray-600">
              Counts from the ANS square-foot spade catalogue (
              <code className="text-xs">ANS_Spade_clean.csv</code>,{' '}
              {formatNumber(ansSquare.totalSpecimens)} specimens). Each specimen is assigned to a
              mint town via its obverse inscription and the typology file (方足布).
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <span>
                <strong>{ansSquare.mapped.length}</strong> mapped mint towns
              </span>
              <span>
                <strong>{formatNumber(ansSquare.totalSpecimens)}</strong> ANS specimens
              </span>
              {ansSquare.unmatchedInscriptions.length > 0 && (
                <span className="text-xs text-amber-700">
                  {ansSquare.unmatchedInscriptions.length} inscription(s) without mapped coordinates
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="overflow-hidden border border-brand/20 bg-white shadow-sm">
        <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
          Mint Production Heatmap
        </div>
        <div className="p-4">
          {active.mapped.length > 0 ? (
            <PointedSpadeHeatmap mints={active.mapped} source={source} />
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
                  <th className="py-2 pr-4">{isAns ? 'Specimens' : 'Coins'}</th>
                  {source === 'database' && <th className="py-2 pr-4">Finds</th>}
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
                    {source === 'database' && (
                      <td className="py-2 pr-4 tabular-nums">{formatNumber(mint.findCount)}</td>
                    )}
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
          {source === 'database' ? (
            <ul className="space-y-2 text-sm leading-7 text-gray-700">
              <li>
                <strong>Typology:</strong> mint names under 尖足布 in{' '}
                <code className="text-xs">Typology.xlsx</code>
              </li>
              <li>
                <strong>Mint towns:</strong> geolocation from mint town dossiers
              </li>
              <li>
                <strong>Counts:</strong> summed from find records linked to pointed-foot spade coin
                types
              </li>
            </ul>
          ) : source === 'ans-pointed' ? (
            <ul className="space-y-2 text-sm leading-7 text-gray-700">
              <li>
                <strong>ANS catalogue:</strong> {formatNumber(ansPointed.totalSpecimens)} specimens in{' '}
                <code className="text-xs">public/data/ans-pointed-spade.json</code>
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
                <strong>ANS catalogue:</strong> {formatNumber(ansSquare.totalSpecimens)} specimens in{' '}
                <code className="text-xs">public/data/ans-square-spade.json</code>
              </li>
              <li>
                <strong>Typology:</strong> obverse inscription → mint town (方足布 only)
              </li>
              <li>
                <strong>Mint towns:</strong> map coordinates from mint town dossiers
              </li>
              {ans.unmatchedInscriptions.length > 0 && (
                <li className="text-xs text-amber-700">
                  Unmapped inscriptions: {ans.unmatchedInscriptions.slice(0, 12).join('、')}
                  {ans.unmatchedInscriptions.length > 12 ? '…' : ''}
                </li>
              )}
            </ul>
          )}
        </DataCard>
      </div>
    </>
  )
}
