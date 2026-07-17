import {
  TYPOLOGY,
  type TypologyL1,
  type TypologyL2,
  type TypologyL3,
  type TypologyLeaf,
} from '@/lib/typology-data'
import { getMatchingCoinTypeCodes, type TypologyFilterSelection } from '@/lib/typology-filter'
import type { CoinType, HeatmapFind } from '@/lib/types'

export type CoinTypeLevel = 'l1' | 'l2' | 'l3' | 'l4'

export type CoinTypeParentRef = {
  slug: string
  label_zh: string
  label_en: string
}

export type MintRef = {
  mint_zh: string
  mint_en: string | null
}

export type StateRef = {
  state_zh: string
  state_en: string | null
}

export type InscriptionRef = {
  inscription_zh: string
  inscription_en: string | null
  mint_zh: string | null
}

export type CoinTypeNode = {
  slug: string
  level: CoinTypeLevel
  label_zh: string
  label_en: string
  /** The typology-filter.ts selection that resolves exactly to this node —
   * feed straight into getMatchingCoinTypeCodes / TypologyFilterBar. */
  sel: TypologyFilterSelection
  /** Root first, immediate parent last. Empty for L1 nodes. */
  parents: CoinTypeParentRef[]
  states: StateRef[]
  mints: MintRef[]
  inscriptions: InscriptionRef[]
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'type'
}

/** Every leaf entry within a subtree — L4 nodes have no entries of their own
 * (Typology.xlsx only lists inscriptions under L3), so they inherit their
 * parent L3's list, same as typology-filter.ts's getInscriptionEntries does
 * for an L4 selection. Level-specific (rather than one generic recursive
 * helper) because TypologyL1/L2/L3/L4 have genuinely different shapes. */
function collectEntriesL3(l3: TypologyL3): TypologyLeaf[] {
  return l3.entries
}

function collectEntriesL2(l2: TypologyL2): TypologyLeaf[] {
  if (l2.entries) return l2.entries
  return l2.children.flatMap(collectEntriesL3)
}

function collectEntriesL1(l1: TypologyL1): TypologyLeaf[] {
  if (l1.entries) return l1.entries
  return l1.children.flatMap(collectEntriesL2)
}

function dedupeMints(entries: TypologyLeaf[]): MintRef[] {
  const seen = new Map<string, MintRef>()
  entries.forEach((e) => {
    const zh = e.mint_zh?.trim()
    if (!zh || seen.has(zh)) return
    seen.set(zh, { mint_zh: zh, mint_en: e.mint_en })
  })
  return [...seen.values()].sort((a, b) => a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))
}

function dedupeStates(entries: TypologyLeaf[]): StateRef[] {
  const seen = new Map<string, StateRef>()
  entries.forEach((e) => {
    const zh = e.state_zh?.trim()
    if (!zh || seen.has(zh)) return
    seen.set(zh, { state_zh: zh, state_en: e.state_en })
  })
  return [...seen.values()].sort((a, b) => a.state_zh.localeCompare(b.state_zh, 'zh-CN'))
}

function dedupeInscriptions(entries: TypologyLeaf[]): InscriptionRef[] {
  const seen = new Map<string, InscriptionRef>()
  entries.forEach((e) => {
    const zh = e.inscription_zh?.trim()
    if (!zh || seen.has(zh)) return
    seen.set(zh, { inscription_zh: zh, inscription_en: e.inscription_en, mint_zh: e.mint_zh })
  })
  return [...seen.values()].sort((a, b) => a.inscription_zh.localeCompare(b.inscription_zh, 'zh-CN'))
}

function uniqueSlug(candidate: string, used: Set<string>, fallbackPrefix: string): string {
  if (!used.has(candidate)) return candidate
  const prefixed = `${fallbackPrefix}-${candidate}`
  if (!used.has(prefixed)) return prefixed
  let i = 2
  while (used.has(`${prefixed}-${i}`)) i++
  return `${prefixed}-${i}`
}

function buildCoinTypeNodes(): CoinTypeNode[] {
  const used = new Set<string>()
  const nodes: CoinTypeNode[] = []

  TYPOLOGY.forEach((l1) => {
    const l1Slug = uniqueSlug(slugify(l1.label_en), used, 'l1')
    used.add(l1Slug)
    const l1Entries = collectEntriesL1(l1)
    nodes.push({
      slug: l1Slug,
      level: 'l1',
      label_zh: l1.label_zh,
      label_en: l1.label_en,
      sel: { l1: l1.label_en, l2: '', l3: '', l4: '', inscription: '' },
      parents: [],
      states: dedupeStates(l1Entries),
      mints: dedupeMints(l1Entries),
      inscriptions: dedupeInscriptions(l1Entries),
    })
    const l1Parent: CoinTypeParentRef = { slug: l1Slug, label_zh: l1.label_zh, label_en: l1.label_en }

    l1.children.forEach((l2) => {
      const l2Slug = uniqueSlug(slugify(l2.label_en), used, l1Slug)
      used.add(l2Slug)
      const l2Entries = collectEntriesL2(l2)
      nodes.push({
        slug: l2Slug,
        level: 'l2',
        label_zh: l2.label_zh,
        label_en: l2.label_en,
        sel: { l1: l1.label_en, l2: l2.label_en, l3: '', l4: '', inscription: '' },
        parents: [l1Parent],
        states: dedupeStates(l2Entries),
        mints: dedupeMints(l2Entries),
        inscriptions: dedupeInscriptions(l2Entries),
      })
      const l2Parent: CoinTypeParentRef = { slug: l2Slug, label_zh: l2.label_zh, label_en: l2.label_en }

      l2.children.forEach((l3) => {
        const l3Slug = uniqueSlug(slugify(l3.label_en), used, l2Slug)
        used.add(l3Slug)
        const l3Entries = collectEntriesL3(l3)
        nodes.push({
          slug: l3Slug,
          level: 'l3',
          label_zh: l3.label_zh,
          label_en: l3.label_en,
          sel: { l1: l1.label_en, l2: l2.label_en, l3: l3.label_en, l4: '', inscription: '' },
          parents: [l1Parent, l2Parent],
          states: dedupeStates(l3Entries),
          mints: dedupeMints(l3Entries),
          inscriptions: dedupeInscriptions(l3Entries),
        })
        const l3Parent: CoinTypeParentRef = { slug: l3Slug, label_zh: l3.label_zh, label_en: l3.label_en }

        l3.children.forEach((l4) => {
          const l4Slug = uniqueSlug(slugify(l4.label_en), used, l3Slug)
          used.add(l4Slug)
          // L4 has no entries of its own — inherit L3's, same rule
          // typology-filter.ts's getInscriptionEntries uses.
          nodes.push({
            slug: l4Slug,
            level: 'l4',
            label_zh: l4.label_zh,
            label_en: l4.label_en,
            sel: { l1: l1.label_en, l2: l2.label_en, l3: l3.label_en, l4: l4.label_en, inscription: '' },
            parents: [l1Parent, l2Parent, l3Parent],
            states: dedupeStates(l3Entries),
            mints: dedupeMints(l3Entries),
            inscriptions: dedupeInscriptions(l3Entries),
          })
        })
      })
    })
  })

  return nodes
}

/** Every L1–L4 category node in the typology tree, flattened — 38 nodes as
 * of the current Typology.xlsx (5 major types, their subcategories, types,
 * and variants). Individual inscriptions are data shown on these nodes'
 * pages, not nodes of their own. */
export const COIN_TYPE_NODES: CoinTypeNode[] = buildCoinTypeNodes()

export function getCoinTypeNodeBySlug(slug: string): CoinTypeNode | undefined {
  return COIN_TYPE_NODES.find((n) => n.slug === slug)
}

export type CoinTypeCounts = { coinCount: number; siteCount: number }

/** Total coin quantity + distinct find-site count for one typology node,
 * from the same raw finds/coinTypes data the Find Site map visualization
 * uses — so the numbers shown here always agree with what filtering to
 * this type on the map would show. */
export function computeCoinTypeCounts(
  sel: TypologyFilterSelection,
  finds: HeatmapFind[],
  coinTypes: CoinType[]
): CoinTypeCounts {
  const matchedCodes = getMatchingCoinTypeCodes(coinTypes, sel)
  if (!matchedCodes) return { coinCount: 0, siteCount: 0 }

  let coinCount = 0
  const sites = new Set<string>()
  finds.forEach((f) => {
    if (!f.coin_type_code || !matchedCodes.has(f.coin_type_code)) return
    coinCount += f.quantity_total ?? f.quantity_estimated ?? f.quantity_min ?? 0
    if (f.site_code) sites.add(f.site_code)
  })
  return { coinCount, siteCount: sites.size }
}

/** Counts for every node at once — one pass building matched-code sets per
 * node, then one pass over `finds` per node (38 nodes × a few thousand
 * finds is trivial server-side work, no need for a fancier single-pass
 * algorithm). */
export function computeAllCoinTypeCounts(
  finds: HeatmapFind[],
  coinTypes: CoinType[]
): Record<string, CoinTypeCounts> {
  const result: Record<string, CoinTypeCounts> = {}
  COIN_TYPE_NODES.forEach((node) => {
    result[node.slug] = computeCoinTypeCounts(node.sel, finds, coinTypes)
  })
  return result
}
