import { getMintByNameZh, MINT_TOWNS, type MintTown } from '@/lib/mint-towns'
import type { MintRow } from '@/lib/queries'
import type { CoinIssueDisplay } from '@/lib/types'

/**
 * A live `mints` row merged with its matching static MintTown dossier (if
 * any), for now — per-field the DB wins wherever it has data, and the local
 * dossier fills in whatever the DB table doesn't carry yet (state, modern
 * location, images, references, coin-type labels). Shaped as a MintTown
 * superset so MintListClient/MintPlaceholder/MintImageGallery keep working
 * unchanged; `db_id`/`db_description_zh`/`citation`/`precision_level` are
 * the new DB-only fields.
 */
export type MintDirectoryEntry = MintTown & {
  db_id: string
  db_description_zh: string | null
  citation: string | null
  precision_level: number | null
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mint'
  )
}

function uniqueSlug(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) return candidate
  let i = 2
  while (used.has(`${candidate}-${i}`)) i++
  return `${candidate}-${i}`
}

/**
 * Builds the full mint directory from live DB rows. Every live mint gets an
 * entry — matched to a static dossier by name_zh where one exists (reusing
 * the same alias-aware lookup used elsewhere), else routed under a slug
 * generated from its English name. Static mint_codes are reserved first, so
 * existing `/mints/[mint_code]` links never change.
 */
export function buildMintDirectory(dbMints: MintRow[]): MintDirectoryEntry[] {
  const used = new Set(MINT_TOWNS.map((t) => t.mint_code))

  const entries = dbMints.map((row): MintDirectoryEntry => {
    const town = getMintByNameZh(row.name_zh)
    const mint_code = town?.mint_code ?? uniqueSlug(slugify(row.name_en ?? row.id), used)
    if (!town) used.add(mint_code)

    return {
      mint_code,
      name_zh: row.name_zh,
      name_en: row.name_en,
      state_zh: town?.state_zh ?? '未知',
      state_en: town?.state_en ?? 'Unknown',
      modern_location_en: town?.modern_location_en ?? 'See description',
      modern_location_zh: town?.modern_location_zh ?? null,
      lat: row.latitude ?? town?.lat ?? null,
      lng: row.longitude ?? town?.lng ?? null,
      description_en: row.description_en || town?.description_en || '',
      coin_types: town?.coin_types ?? [],
      references: town?.references ?? [],
      images: town?.images,
      db_id: row.id,
      db_description_zh: row.description_zh,
      citation: row.citation,
      precision_level: row.precision_level,
    }
  })

  return entries.sort((a, b) => a.name_zh.localeCompare(b.name_zh, 'zh-CN'))
}

export function getMintDirectoryEntryBySlug(
  directory: MintDirectoryEntry[],
  slug: string
): MintDirectoryEntry | undefined {
  return directory.find((m) => m.mint_code === slug)
}

export type MintTypeLabel = { zh: string; en: string | null }

/**
 * Distinct coin-type labels actually catalogued at each mint, computed live
 * from `coin_issues` (bilingual) — the replacement for reading
 * `MintTown.coin_types`, which is a hand-transcribed, **English-only**
 * dossier field with no Chinese counterpart in the data at all. Keyed by
 * mint_zh, matching how `statsByMint` is keyed on the `/mints` list page.
 * Uses the same "deepest populated hierarchy level, minor falling back to
 * major" resolution `getMintFindspotsData` uses for a single mint.
 */
export function buildMintTypeLabels(coinIssues: CoinIssueDisplay[]): Map<string, MintTypeLabel[]> {
  const byMint = new Map<string, Map<string, MintTypeLabel>>()

  coinIssues.forEach((c) => {
    const mintZh = c.mint_zh?.trim()
    const zh = c.minor_type_zh ?? c.major_type_zh
    if (!mintZh || !zh) return
    const en = c.minor_type_zh ? c.minor_type_en : c.major_type_en
    if (!byMint.has(mintZh)) byMint.set(mintZh, new Map())
    const labels = byMint.get(mintZh)!
    if (!labels.has(zh)) labels.set(zh, { zh, en })
  })

  const result = new Map<string, MintTypeLabel[]>()
  byMint.forEach((labels, mintZh) => {
    result.set(mintZh, [...labels.values()].sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN')))
  })
  return result
}
