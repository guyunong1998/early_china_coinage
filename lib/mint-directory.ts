import { getMintByNameZh, MINT_TOWNS, type MintTown } from '@/lib/mint-towns'
import type { MintRow } from '@/lib/queries'

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
    const mint_code = town?.mint_code ?? uniqueSlug(slugify(row.name_en), used)
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
