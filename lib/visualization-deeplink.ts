import { emptyTypologySelection, type TypologyFilterSelection } from '@/lib/typology-filter'
import type { FilterMode, ViewMode } from '@/lib/context-heatmap'

/**
 * URL query-param encoding for "pre-built" links into a map visualization
 * page with a specific filter state already applied — used by the homepage
 * demo carousel (lib/demo-visualizations.ts) so a card's link can drop a
 * visitor straight into e.g. "Find Site, filter by mint, Compare view,
 * Anyang + Anyi selected" with no manual clicking. Every value here is a
 * human-readable zh string (a mint's own name_zh, a coin type's level1..5
 * label), never a database id — ids like coin_issues.mint_id aren't stable
 * enough to hardcode into a demo config, and wouldn't survive someone
 * reading/editing the list either.
 *
 * Levels within one type selection join on LEVEL_SEP; multiple mints or
 * multiple type selections join on ENTRY_SEP. Neither separator character
 * appears in any current mint or typology label — if a future label ever
 * needs one, swap these for characters that don't collide.
 */
const LEVEL_SEP = '>'
const ENTRY_SEP = '|'

export function encodeTypologySelections(sels: TypologyFilterSelection[]): string {
  return sels
    .map((s) => [s.level1, s.level2, s.level3, s.level4, s.level5].filter(Boolean).join(LEVEL_SEP))
    .filter(Boolean)
    .join(ENTRY_SEP)
}

export function decodeTypologySelections(raw: string | undefined): TypologyFilterSelection[] {
  if (!raw) return []
  const LEVEL_KEYS = ['level1', 'level2', 'level3', 'level4', 'level5'] as const
  return raw
    .split(ENTRY_SEP)
    .filter(Boolean)
    .map((entry) => {
      const sel = emptyTypologySelection()
      entry.split(LEVEL_SEP).forEach((value, i) => {
        if (value && LEVEL_KEYS[i]) sel[LEVEL_KEYS[i]] = value
      })
      return sel
    })
}

export function encodeMintNames(names: string[]): string {
  return names.join(ENTRY_SEP)
}

export function decodeMintNames(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(ENTRY_SEP).filter(Boolean)
}

export function parseViewMode(raw: string | undefined): ViewMode | undefined {
  return raw === 'points' || raw === 'density' || raw === 'compare' ? raw : undefined
}

export function parseFilterMode(raw: string | undefined): FilterMode | undefined {
  return raw === 'type' || raw === 'mint' ? raw : undefined
}
