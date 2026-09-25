'use client'

/**
 * The "Search" tab of the Museum Collections filter panel: a client-side
 * filter over every ans_data specimen's accession number, mint, state, and
 * inscription (Chinese or English) — the full specimen list is already
 * fetched server-side for the mint-town map, so this just substring-matches
 * it in memory instead of hitting the database again. Results are
 * multiselectable (checkbox per row, or a grayed-out "unmapped" marker in
 * its place for specimens whose mint has no map coordinates); the parent
 * (AnsMintTownVisualization) turns each selection into its own dropped pin
 * on the map, colored to match the chip shown here — see its `pins` /
 * SELECTION_COLORS wiring. Each result's accession number itself links out
 * to the specimen's record in the ANS Online Collection.
 *
 * Used by: components/visualizations/MapVisualization.tsx's
 * AnsMintTownVisualization (app/museum-collections/page.tsx).
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { T } from '@/components/i18n/T'
import { TranslatedInput } from '@/components/i18n/TranslatedInput'
import { UnquantifiedSwatch } from '@/components/site/CoinTypePieChart'
import { ClickHint } from '@/components/ui/ClickHint'
import { findMintByNameZh } from '@/lib/mint-directory'
import { ansCollectionUrl, type AnsSpecimen } from '@/lib/mint-stats'
import type { InscriptionSourceRow } from '@/lib/typology-filter'
import type { MintInfo } from '@/lib/types'

const MAX_RESULTS = 200

/** Sort priority — 0 is shown first, higher is pushed toward the bottom.
 * Specimens missing an accession number sink to the very bottom regardless
 * of mint status; among the rest, an unmapped mint sinks below a mapped
 * one. */
function specimenTier(catalogNumber: string | null, isMapped: boolean): number {
  if (!catalogNumber) return 2
  return isMapped ? 0 : 1
}

export function AccessionNumberSearch({
  specimens,
  mints,
  inscriptionSource,
  selectedKeys,
  selectedSpecimens,
  onToggle,
  onClear,
}: {
  specimens: AnsSpecimen[]
  mints: MintInfo[]
  /** Resolves a specimen's inscription_id to its bilingual coin_issues label
   * (falling back to the specimen's own inscription_raw), so search can
   * match an English inscription too — see buildAnsInscriptionSource's doc
   * comment for why ans_data doesn't carry inscription_en itself. */
  inscriptionSource: InscriptionSourceRow[]
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

  // Each specimen's resolved mint (for isMapped + the mint-code link) and
  // English inscription, precomputed once per specimens/mints/coinIssues
  // change rather than re-looked-up on every keystroke or render.
  const mintBySpecimenId = useMemo(() => {
    const m = new Map<string, MintInfo | undefined>()
    specimens.forEach((s) => m.set(s.id, s.mint_zh ? findMintByNameZh(mints, s.mint_zh) : undefined))
    return m
  }, [specimens, mints])

  const inscriptionEnById = useMemo(() => {
    const m = new Map<string, string | null>()
    inscriptionSource.forEach((row) => {
      if (row.inscription_id) m.set(row.inscription_id, row.inscription_en)
    })
    return m
  }, [inscriptionSource])

  // Browsable even with no query — the full (sorted) list, not just search
  // hits, so the checkbox list always has something to scroll through.
  const filteredSpecimens = useMemo(() => {
    const matches = (s: AnsSpecimen) => {
      if (!trimmed) return true
      const inscriptionEn = s.inscription_id ? inscriptionEnById.get(s.inscription_id) : null
      return [s.catalog_number, s.mint_zh, s.mint_en, s.state_zh, s.state_en, s.inscription_raw, inscriptionEn].some(
        (field) => field?.toLowerCase().includes(trimmed)
      )
    }
    const base = trimmed ? specimens.filter(matches) : specimens
    return [...base].sort((a, b) => {
      const tierDiff =
        specimenTier(a.catalog_number, mintBySpecimenId.get(a.id)?.lat != null) -
        specimenTier(b.catalog_number, mintBySpecimenId.get(b.id)?.lat != null)
      if (tierDiff !== 0) return tierDiff
      return (a.catalog_number ?? '').localeCompare(b.catalog_number ?? '') || a.id.localeCompare(b.id)
    })
  }, [specimens, trimmed, mintBySpecimenId, inscriptionEnById])

  const results = useMemo(() => filteredSpecimens.slice(0, MAX_RESULTS), [filteredSpecimens])
  const truncated = filteredSpecimens.length > MAX_RESULTS

  return (
    <div className="space-y-2.5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <p className="shrink-0 text-sm leading-snug text-gray-700">
        <T k="museum.search.hint" vars={{ count: specimens.length }} />
      </p>

      <TranslatedInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholderKey="museum.search.placeholder"
        className="w-full shrink-0 rounded form-input px-2.5 py-1.5 text-gray-800"
        style={{ background: 'var(--paper)' }}
      />

      {selectedSpecimens.length > 0 && (
        <div className="shrink-0 space-y-1.5 rounded border border-brand/15 bg-brand-light/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs eyebrow text-gray-500">
              <T k="ui.selectedCount" vars={{ count: selectedSpecimens.length }} />
            </span>
            <button type="button" onClick={onClear} className="text-link-sm">
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

      <p className="shrink-0 text-xs text-gray-500">
        {truncated ? (
          <T k="museum.search.truncated" vars={{ shown: results.length, total: filteredSpecimens.length }} />
        ) : (
          <T
            k={filteredSpecimens.length === 1 ? 'search.resultCountOne' : 'search.resultCount'}
            vars={{ count: filteredSpecimens.length }}
          />
        )}
      </p>

      {filteredSpecimens.length === 0 ? (
        <p className="shrink-0 text-sm text-gray-700">
          {trimmed ? <T k="museum.search.noResults" vars={{ query }} /> : <T k="museum.search.empty" />}
        </p>
      ) : (
        <div
          className="max-h-72 overflow-y-auto rounded border border-brand/30 lg:max-h-none lg:min-h-0 lg:flex-1"
          style={{ background: 'var(--paper)' }}
        >
          <ul className="divide-y divide-gray-100">
            {results.map((s) => {
              const catalogNumber = s.catalog_number
              const isSelected = selectedKeys.has(s.id)
              const selectionColor = colorById.get(s.id)
              const mint = mintBySpecimenId.get(s.id)
              const isMapped = mint?.lat != null
              return (
                <li key={s.id} className="flex items-start gap-2 px-2 py-2 text-sm">
                  {isMapped ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(s.id)}
                      aria-label={catalogNumber ?? undefined}
                      style={selectionColor ? { accentColor: selectionColor } : undefined}
                      className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer"
                    />
                  ) : (
                    <ClickHint
                      hint={<T k="museum.search.unmappedHint" />}
                      className="mt-1 inline-flex shrink-0 cursor-help"
                      panelClassName="w-52"
                    >
                      <UnquantifiedSwatch className="h-3.5 w-3.5" />
                    </ClickHint>
                  )}
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
                      {s.mint_zh ? (
                        <span className={isMapped ? 'text-gray-800' : 'text-gray-400'}>
                          {mint?.mint_code ? (
                            <Link href={`/mints/${mint.mint_code}`} className="text-brand hover:underline">
                              {s.mint_zh}
                            </Link>
                          ) : (
                            s.mint_zh
                          )}
                          {s.mint_en && <span className="muted-italic"> ({s.mint_en})</span>}
                        </span>
                      ) : (
                        <span className="text-xs muted-italic">
                          <T k="museum.search.unmapped" />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {s.inscription_raw && (
                        <span>
                          <T k="museum.search.inscriptionLabel" /> {s.inscription_raw}
                        </span>
                      )}
                      {s.state_zh && (
                        <span>
                          <T k="museum.search.stateLabel" /> {s.state_zh}
                          {s.state_en && <span className="muted-italic"> ({s.state_en})</span>}
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
    </div>
  )
}
