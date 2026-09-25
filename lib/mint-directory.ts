import { toEnglishName } from '@/lib/name-translation'
import type { MintRow } from '@/lib/queries'
import type { CoinIssueDisplay, ImageRecord, MintImage, MintInfo } from '@/lib/types'

/** Shown in place of a modern-location value when neither language is
 * recorded, pointing readers at the description field instead — bilingual so
 * it never displays as English-only text next to a Chinese place name (see
 * toMintInfo below). Also compared against directly in mintCompleteness. */
const MODERN_LOCATION_FALLBACK = 'See description / 见描述'

/** Resolves a public.images row to the shape MintImageGallery renders —
 * `filename` is stored relative to public/images/, so the actual asset path
 * is `/images/${filename}`. `source_id` and `source_text` are mutually
 * exclusive at the DB level (see the images table's check constraint), so
 * exactly one of the catalogued source's citation or the one-off
 * source_text supplies the credit line, if either is set. */
function imageRecordToMintImage(img: ImageRecord): MintImage {
  const source = Array.isArray(img.sources) ? img.sources[0] : img.sources
  const sourceCredit = source?.citation_en ?? source?.citation_zh ?? source?.url ?? undefined
  return {
    src: `/images/${img.filename}`,
    caption: img.caption_en ?? img.caption_zh ?? undefined,
    credit: img.source_text ?? sourceCredit ?? undefined,
    kind: img.note_zh === '铭文材料' ? 'inscription' : 'map',
  }
}

/** Flattens a live `mints` row (nested `states` join, latitude/longitude) into
 * the flat MintInfo shape most consumers want. `name_en` falls back to a
 * tone-less pinyin romanization (lib/name-translation.ts) for the handful of
 * mints that have never had one recorded. */
export function toMintInfo(row: MintRow): MintInfo {
  const state = Array.isArray(row.states) ? row.states[0] : row.states
  return {
    id: row.id,
    mint_code: row.mint_code,
    name_zh: row.name_zh,
    name_en: toEnglishName(row.name_zh, row.name_en),
    state_zh: state?.state_zh ?? '未知',
    state_en: state?.state_en ?? 'Unknown',
    modern_location_en: row.modern_location_en ?? MODERN_LOCATION_FALLBACK,
    modern_location_zh: row.modern_location_zh,
    lat: row.latitude,
    lng: row.longitude,
    alternative_names: row.alternative_names,
  }
}

/** Exact match on name_zh only — coin_issues.mint_id / ans_data.mint_id are
 * real foreign keys, so a mint's own name_zh (as already resolved by that
 * join) always matches exactly. Deliberately does NOT also check
 * alternative_names: if a lookup here ever misses, that's a genuine data
 * inconsistency (e.g. a stale/renamed mint) worth surfacing, not something
 * to paper over with a fuzzier match. */
export function findMintByNameZh(mints: MintInfo[], nameZh: string | null | undefined): MintInfo | undefined {
  const trimmed = nameZh?.trim()
  if (!trimmed) return undefined
  return mints.find((m) => m.name_zh === trimmed)
}

/**
 * A live `mints` row, flattened and with its images/description/etc. fully
 * resolved for display — everything here comes straight from the database
 * now (state, modern location, location_note, sources_unlinked, images via
 * image_ids); there is no more local static fallback layer.
 */
export type MintDirectoryEntry = MintInfo & {
  description_zh: string | null
  description_en: string
  citation: string | null
  precision_level: number | null
  location_note: string | null
  /** Raw citation strings not yet linked to a public.sources row — a
   * manual-verification queue, not a finished bibliography. */
  sources_unlinked: string[]
  images: MintImage[]
}

/**
 * Builds the full mint directory straight from live DB rows — every mint
 * gets an entry keyed by its DB-native `mint_code` (stable /mints/[mint_code]
 * URL slug). `images` is the full public.images catalogue (from
 * lib/queries.ts's getImages) — each mint's own `image_ids` are resolved
 * against it.
 */
export function buildMintDirectory(dbMints: MintRow[], images: ImageRecord[] = []): MintDirectoryEntry[] {
  const imagesById = new Map(images.map((img) => [img.id, img]))

  const entries = dbMints.map((row): MintDirectoryEntry => {
    const dbImages = row.image_ids.flatMap((id) => {
      const img = imagesById.get(id)
      return img ? [imageRecordToMintImage(img)] : []
    })

    return {
      ...toMintInfo(row),
      description_zh: row.description_zh,
      description_en: row.description_en ?? '',
      citation: row.citation,
      precision_level: row.precision_level,
      location_note: row.location_note,
      sources_unlinked: row.sources_unlinked,
      images: dbImages,
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

/**
 * How complete a mint's documented record is — one point each for state,
 * modern location, coordinates, a substantive description, sources, and
 * images, out of a max of 6. Used to sort the `/mints` list by "completion
 * of information"; not shown as a number anywhere, so the exact weighting is
 * deliberately informal.
 */
export function mintCompleteness(mint: MintDirectoryEntry): number {
  let score = 0
  if (mint.state_zh !== '未知') score += 1
  if (mint.modern_location_zh || mint.modern_location_en !== MODERN_LOCATION_FALLBACK) score += 1
  if (mint.lat != null && mint.lng != null) score += 1
  if (mint.description_en.length > 60 || (mint.description_zh?.length ?? 0) > 0) score += 1
  if (mint.sources_unlinked.length > 0) score += 1
  if (mint.images.length > 0) score += 1
  return score
}

export type MintTypeLabel = { zh: string; en: string | null }

/**
 * Distinct coin-type labels actually catalogued at each mint, computed live
 * from `coin_issues` (bilingual). Keyed by mint_zh, matching how
 * `statsByMint` is keyed on the `/mints` list page.
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
