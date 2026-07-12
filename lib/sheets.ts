/**
 * Google Sheets integration — reads mint town data from a published CSV.
 *
 * Setup:
 *  1. Create a Google Sheet with the columns listed in EXPECTED_COLUMNS below.
 *  2. File → Share → Publish to web → Sheet 1 → CSV → Publish.
 *  3. Copy the URL and add it to .env.local as GOOGLE_SHEET_MINTS_CSV_URL.
 *
 * The sheet is refetched at most once per hour in production (Next.js ISR).
 * To force a refresh, redeploy or set GOOGLE_SHEET_REVALIDATE_SECONDS=0.
 */

import type { MintTown, MintReference } from '@/lib/mint-towns'

// Column names expected in row 1 of the sheet (order does not matter)
// prettier-ignore
const EXPECTED_COLUMNS = [
  'mint_code',        // e.g. anyi
  'name_zh',          // e.g. 安邑
  'name_en',          // e.g. Anyi
  'state_zh',         // e.g. 魏
  'state_en',         // e.g. Wei
  'modern_location_en', // e.g. Xia County, Yuncheng, Shanxi
  'lat',              // e.g. 35.18071997991436
  'lng',              // e.g. 111.16366245816664
  'description_en',   // free text description (can contain commas — wrap cell in quotes)
  'coin_types',       // pipe-separated list  e.g.  Bridge-foot spades|Square-foot spades
  'references',       // pipe-separated list, each item: citation_zh // citation_en // url
                      //   e.g.  陶正刚…1962年 // Tao and Ye... 1962. // https://...
] as const

const REVALIDATE = Number(process.env.GOOGLE_SHEET_REVALIDATE_SECONDS ?? 3600)

// ─── CSV parser (handles quoted fields with commas/newlines) ──────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur.trim())
  return fields
}

function parseReferences(raw: string): MintReference[] {
  if (!raw.trim()) return []
  return raw
    .split('|')
    .map((entry) => {
      const parts = entry.split('//').map((s) => s.trim())
      return {
        citation_zh: parts[0] ?? '',
        citation_en: parts[1] || undefined,
        url: parts[2] || undefined,
      }
    })
    .filter((r) => r.citation_zh)
}

function parseCoinTypes(raw: string): string[] {
  if (!raw.trim()) return []
  return raw.split('|').map((s) => s.trim()).filter(Boolean)
}

function parseRow(headers: string[], values: string[]): MintTown | null {
  const row: Record<string, string> = {}
  headers.forEach((h, i) => { row[h] = values[i] ?? '' })

  const mint_code = row.mint_code?.trim()
  if (!mint_code) return null

  const lat = parseFloat(row.lat)
  const lng = parseFloat(row.lng)
  if (isNaN(lat) || isNaN(lng)) return null

  return {
    mint_code,
    name_zh: row.name_zh ?? '',
    name_en: row.name_en ?? '',
    state_zh: row.state_zh ?? '',
    state_en: row.state_en ?? '',
    modern_location_en: row.modern_location_en ?? '',
    lat,
    lng,
    description_en: row.description_en ?? '',
    coin_types: parseCoinTypes(row.coin_types ?? ''),
    references: parseReferences(row.references ?? ''),
    // images are still managed locally in lib/mint-towns.ts
    images: undefined,
  }
}

// ─── main export ──────────────────────────────────────────────────────────

export type SheetFetchResult =
  | { source: 'sheet'; mints: MintTown[]; fetchedAt: string }
  | { source: 'env_missing' }
  | { source: 'error'; message: string }

export async function fetchMintsFromSheet(): Promise<SheetFetchResult> {
  const url = process.env.GOOGLE_SHEET_MINTS_CSV_URL
  if (!url) return { source: 'env_missing' }

  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
    })

    if (!res.ok) {
      return { source: 'error', message: `HTTP ${res.status} from Google Sheets` }
    }

    const text = await res.text()
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      return { source: 'error', message: 'Sheet appears to be empty' }
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
    const mints = lines
      .slice(1)
      .map((line) => parseRow(headers, parseCSVLine(line)))
      .filter((m): m is MintTown => m !== null)

    return { source: 'sheet', mints, fetchedAt: new Date().toISOString() }
  } catch (err) {
    return { source: 'error', message: String(err) }
  }
}
