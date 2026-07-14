import fs from 'fs'
import path from 'path'
import { getMintByNameZh, resolveMintNameZh } from '@/lib/mint-towns'
import { TYPOLOGY } from '@/lib/typology-data'
import type { PointedSpadeMintStat } from '@/lib/pointed-spade-data'

export type AnsSquareSpadeRecord = {
  catalog_number: string | null
  obverse_inscription: string
  reverse_inscription: string | null
}

export type AnsPointedSpadeRecord = {
  catalog_number: string | null
  inscription: string
}

export type AnsMintStats = {
  mapped: PointedSpadeMintStat[]
  unmapped: PointedSpadeMintStat[]
  totalSpecimens: number
  unmatchedInscriptions: string[]
}

/** Map coin inscription → mint town using Typology.xlsx entries for a given spade type. */
function buildInscriptionToMintMap(typeKey: '尖足布' | '方足布'): Map<string, string> {
  const map = new Map<string, string>()

  for (const l1 of TYPOLOGY) {
    for (const l2 of l1.children) {
      for (const l3 of l2.children) {
        if (l3.type_key !== typeKey) continue
        if (l3.entries) {
          for (const entry of l3.entries) {
            const insc = entry.inscription_zh?.trim()
            const mint = entry.mint_zh?.trim()
            if (insc && mint && !map.has(insc)) map.set(insc, mint)
          }
        }
      }
    }
  }

  return map
}

function resolveMintFromInscription(inscription: string, inscToMint: Map<string, string>): string {
  const trimmed = inscription.trim()
  if (!trimmed) return ''

  const fromTypology = inscToMint.get(trimmed)
  if (fromTypology) return resolveMintNameZh(fromTypology)

  // Inscription may itself be the mint name (e.g. 蔺).
  const direct = resolveMintNameZh(trimmed)
  if (getMintByNameZh(direct)) return direct

  return trimmed
}

function aggregateAnsMintStats(
  records: { inscription: string }[],
  typeKey: '尖足布' | '方足布'
): AnsMintStats {
  const inscToMint = buildInscriptionToMintMap(typeKey)

  const groups = new Map<string, { coinCount: number; inscriptions: Set<string> }>()
  const unmatched = new Set<string>()

  records.forEach((row) => {
    const insc = row.inscription.trim()
    const mintZh = resolveMintFromInscription(insc, inscToMint)
    if (!mintZh) return

    const town = getMintByNameZh(mintZh)
    if (!town?.lat || !town?.lng) {
      unmatched.add(insc)
    }

    if (!groups.has(mintZh)) {
      groups.set(mintZh, { coinCount: 0, inscriptions: new Set() })
    }
    const group = groups.get(mintZh)!
    group.coinCount += 1
    group.inscriptions.add(insc)
  })

  const stats: PointedSpadeMintStat[] = [...groups.entries()]
    .map(([mint_zh, g]) => {
      const town = getMintByNameZh(mint_zh)
      return {
        mint_zh,
        mint_en: town?.name_en ?? null,
        mint_code: town?.mint_code ?? null,
        lat: town?.lat ?? NaN,
        lng: town?.lng ?? NaN,
        findCount: g.coinCount,
        coinCount: g.coinCount,
        inscriptions: [...g.inscriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        state_zh: town?.state_zh ?? null,
        state_en: town?.state_en ?? null,
        modern_location_en: town?.modern_location_en ?? null,
        inTypology: inscToMint.has(mint_zh) || [...g.inscriptions].some((i) => inscToMint.has(i)),
        inMintTowns: !!town,
      }
    })
    .sort((a, b) => b.coinCount - a.coinCount || a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))

  const mapped = stats.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  const unmapped = stats.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng))

  return {
    mapped,
    unmapped,
    totalSpecimens: records.length,
    unmatchedInscriptions: [...unmatched].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  }
}

export function loadAnsPointedSpadeRecords(): AnsPointedSpadeRecord[] {
  const file = path.join(process.cwd(), 'public/data/ans-pointed-spade.json')
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8')) as AnsPointedSpadeRecord[]
}

export function loadAnsSquareSpadeRecords(): AnsSquareSpadeRecord[] {
  const file = path.join(process.cwd(), 'public/data/ans-square-spade.json')
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8')) as AnsSquareSpadeRecord[]
}

/** ANS pointed-foot spade (尖足布) catalogue aggregated by mint town. */
export function getAnsPointedSpadeMintStats(): AnsMintStats {
  const records = loadAnsPointedSpadeRecords().map((row) => ({
    inscription: row.inscription,
  }))
  return aggregateAnsMintStats(records, '尖足布')
}

/** ANS square-foot spade (方足布) catalogue aggregated by mint town. */
export function getAnsSquareSpadeMintStats(): AnsMintStats {
  const records = loadAnsSquareSpadeRecords().map((row) => ({
    inscription: row.obverse_inscription,
  }))
  return aggregateAnsMintStats(records, '方足布')
}
