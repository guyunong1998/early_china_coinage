'use client'

/**
 * The "Search" tab of the Museum Collections filter panel: a client-side
 * filter over every ans_data specimen's catalog_number (ANS accession
 * number, e.g. "1937.146.16801") — the full specimen list is already
 * fetched server-side for the mint-town map, so this just substring-matches
 * it in memory instead of hitting the database again. Results are
 * multiselectable (checkbox per row); the parent (AnsMintTownVisualization)
 * turns each selection into its own dropped pin on the map, colored to match
 * the chip shown here — see its `pins` / SELECTION_COLORS wiring. Each
 * result's accession number itself links out to the specimen's record in
 * the ANS Online Collection.
 *
 * Used by: components/visualizations/MapVisualization.tsx's
 * AnsMintTownVisualization (app/museum-collections/page.tsx).
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { T } from '@/components/i18n/T'
import { TranslatedInput } from '@/components/i18n/TranslatedInput'
import { getMintByNameZh } from '@/lib/mint-towns'
import { ansCollectionUrl, type AnsSpecimen } from '@/lib/pointed-spade-data'

const MAX_RESULTS = 200

export function AccessionNumberSearch({
  specimens,
  selectedKeys,
  selectedSpecimens,
  onToggle,
  onClear,
}: {
  specimens: AnsSpecimen[]
  /** Selected specimen ids (ans_data.id, NOT catalog_number — the live table
   * has specimens sharing an accession number), for quickly checking a
   * result row's state. */
  selectedKeys: Set<string>
  /** Selected specimens in selection order, each paired with the color its
   * map pin (and chip below) uses. */
  selectedSpecimens: { specimen: AnsSpecimen; color: string }[]
  onToggle: (id: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim().toLowerCase()

  const colorById = useMemo(
    () => new Map(selectedSpecimens.map(({ specimen, color }) => [specimen.id, color])),
    [selectedSpecimens]
  )

  // Browsable even with no query — the full (sorted) list, not just search
  // hits, so the checkbox list always has something to scroll through.
  const filteredSpecimens = useMemo(() => {
    const base = trimmed ? specimens.filter((s) => s.catalog_number?.toLowerCase().includes(trimmed)) : specimens
    return [...base].sort(
      (a, b) => (a.catalog_number ?? '').localeCompare(b.catalog_number ?? '') || a.id.localeCompare(b.id)
    )
  }, [specimens, trimmed])

  const results = useMemo(() => filteredSpecimens.slice(0, MAX_RESULTS), [filteredSpecimens])
  const truncated = filteredSpecimens.length > MAX_RESULTS

  return (
    <div className="space-y-2.5">
      <p className="text-sm leading-snug text-gray-700">
        <T k="museum.search.hint" />
      </p>

      <TranslatedInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholderKey="museum.search.placeholder"
        className="w-full rounded border border-brand/30 px-2.5 py-1.5 text-sm text-gray-800 focus:border-brand focus:outline-none"
      />

      {selectedSpecimens.length > 0 && (
        <div className="space-y-1.5 rounded border border-brand/15 bg-brand-light/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <T k="ui.selectedCount" vars={{ count: selectedSpecimens.length }} />
            </span>
            <button type="button" onClick={onClear} className="text-xs font-semibold text-brand hover:underline">
              <T k="ui.clear" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSpecimens.map(({ specimen, color }) => (
              <button
                key={specimen.id}
                type="button"
                onClick={() => onToggle(specimen.id)}
                className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                {specimen.catalog_number}
                <span aria-hidden className="text-gray-400">
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        <T
          k={filteredSpecimens.length === 1 ? 'search.resultCountOne' : 'search.resultCount'}
          vars={{ count: filteredSpecimens.length }}
        />
      </p>

      {filteredSpecimens.length === 0 ? (
        <p className="text-sm text-gray-700">
          {trimmed ? <T k="museum.search.noResults" vars={{ query }} /> : <T k="museum.search.empty" />}
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded border border-brand/30">
          <ul className="divide-y divide-gray-100">
            {results.map((s) => {
              const catalogNumber = s.catalog_number
              const isSelected = selectedKeys.has(s.id)
              const selectionColor = colorById.get(s.id)
              const town = s.mint_zh ? getMintByNameZh(s.mint_zh) : undefined
              const isMapped = town?.lat != null
              return (
                <li key={s.id} className="flex items-start gap-2 px-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(s.id)}
                    aria-label={catalogNumber ?? undefined}
                    style={selectionColor ? { accentColor: selectionColor } : undefined}
                    className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      {catalogNumber ? (
                        <a
                          href={ansCollectionUrl(catalogNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-semibold hover:underline ${isMapped ? 'text-brand' : 'text-gray-400'}`}
                        >
                          {catalogNumber} ↗
                        </a>
                      ) : (
                        <span className="font-semibold text-gray-400">—</span>
                      )}
                      {s.inscription_raw && (
                        <span className={isMapped ? 'text-gray-800' : 'text-gray-400'}>{s.inscription_raw}</span>
                      )}
                      {!isMapped && (
                        <span className="text-xs italic text-gray-400">
                          <T k="museum.search.unmapped" />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {s.reverse_inscription && (
                        <span>
                          <T k="museum.search.reverseLabel" /> {s.reverse_inscription}
                        </span>
                      )}
                      {s.mint_zh && (
                        <span>
                          <T k="museum.search.mintLabel" />{' '}
                          {town?.mint_code ? (
                            <Link href={`/mints/${town.mint_code}`} className="text-brand hover:underline">
                              {s.mint_zh}
                            </Link>
                          ) : (
                            s.mint_zh
                          )}
                          {s.mint_en && <span className="italic text-gray-400"> ({s.mint_en})</span>}
                        </span>
                      )}
                      {s.state_zh && (
                        <span>
                          <T k="museum.search.stateLabel" /> {s.state_zh}
                          {s.state_en && <span className="italic text-gray-400"> ({s.state_en})</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {truncated && (
        <p className="text-xs text-gray-400">
          <T k="museum.search.truncated" vars={{ shown: results.length, total: filteredSpecimens.length }} />
        </p>
      )}
    </div>
  )
}
