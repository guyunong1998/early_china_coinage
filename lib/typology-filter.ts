import type { CoinType } from '@/lib/types'
import { TYPOLOGY, type TypologyL1, type TypologyL2, type TypologyL3, type TypologyLeaf } from '@/lib/typology-data'
import { splitCsv } from '@/lib/format'

export type TypologyFilterSelection = {
  l1: string
  l2: string
  l3: string
  l4: string
  inscription: string
}

export function emptyTypologySelection(): TypologyFilterSelection {
  return { l1: '', l2: '', l3: '', l4: '', inscription: '' }
}

export function resolveTypologyPath(sel: TypologyFilterSelection) {
  const l1 = TYPOLOGY.find((t) => t.label_en === sel.l1)
  const l2 = l1?.children.find((t) => t.label_en === sel.l2)
  const l3 = l2?.children.find((t) => t.label_en === sel.l3)
  const l4 = l3?.children.find((t) => t.label_en === sel.l4)
  return { l1, l2, l3, l4 }
}

/**
 * DB coin_types sometimes use slightly different Chinese labels than Typology.xlsx.
 * Map DB wording → canonical typology key before matching.
 */
const DB_LABEL_ALIASES: Record<string, string> = {
  大型尖足布: '大尖足布',
  大型方足布: '大方足布',
  大型圆足布: '大圆足布',
  大型锐角布: '大锐角布',
  大型平肩空首布: '大型平肩空首布',
  大型耸肩空首布: '尖肩空首布',
  耸肩空首布: '尖肩空首布',
  '明刀（1-4式）': '明刀',
  大型原始刀币: '原始大型刀币',
}

function normalizeLabel(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return ''
  return DB_LABEL_ALIASES[trimmed] ?? trimmed
}

function addLabel(set: Set<string>, ...values: Array<string | null | undefined>) {
  values.forEach((v) => {
    const n = normalizeLabel(v)
    if (n) set.add(n)
    const raw = (v ?? '').trim()
    if (raw) set.add(raw)
  })
}

function addL3Subtree(set: Set<string>, l3: TypologyL3) {
  addLabel(set, l3.label_zh, l3.type_key)
  l3.children.forEach((l4) => addLabel(set, l4.label_zh, l4.filter_key))
}

function addL2Subtree(set: Set<string>, l2: TypologyL2) {
  addLabel(set, l2.label_zh, l2.type_key)
  if (l2.children.length === 0) return
  l2.children.forEach((l3) => addL3Subtree(set, l3))
}

function addL1Subtree(set: Set<string>, l1: TypologyL1) {
  addLabel(set, l1.label_zh)
  l1.children.forEach((l2) => addL2Subtree(set, l2))
}

/**
 * Chinese labels that may appear in coin_types.major_type_zh / minor_type_zh
 * (or site aggregate CSV fields) for the current typology selection.
 *
 * Broader selections include all descendant type keys so a DB row stored as
 * major=尖足布 still matches L1=布币.
 */
export function collectMatchLabels(sel: TypologyFilterSelection): Set<string> {
  const labels = new Set<string>()
  const { l1, l2, l3, l4 } = resolveTypologyPath(sel)
  if (!l1) return labels

  if (l4) {
    addLabel(labels, l4.label_zh, l4.filter_key)
    return labels
  }
  if (l3) {
    addL3Subtree(labels, l3)
    return labels
  }
  if (l2) {
    addL2Subtree(labels, l2)
    return labels
  }
  addL1Subtree(labels, l1)
  return labels
}

/** @deprecated Prefer collectMatchLabels — kept for CoinFilterMap call sites during migration. */
export function collectTypeKeys(sel: TypologyFilterSelection): Set<string> {
  return collectMatchLabels(sel)
}

export function getInscriptionEntries(sel: TypologyFilterSelection): TypologyLeaf[] {
  const { l1, l2, l3, l4 } = resolveTypologyPath(sel)
  // L4 has no own inscription list; use parent L3 entries while L4 type filter still applies.
  if (l4 || l3) return l3?.entries ?? []
  if (l2 && l2.children.length === 0) return l2.entries ?? []
  if (l2) return l2.children.flatMap((c) => c.entries ?? [])
  // L1 leaf (e.g. Round Coin 圜钱): use entries attached on L1 if present
  if (l1 && l1.children.length === 0) return l1.entries ?? []
  if (l1) {
    return (l1.children ?? []).flatMap((child) =>
      child.children.length === 0
        ? child.entries ?? []
        : child.children.flatMap((c) => c.entries ?? [])
    )
  }
  return []
}

/**
 * True when inscription filtering should be offered for the selection.
 * L3/L4 always qualify (inscriptions live on L3). L1/L2 qualify only when
 * they are leaves (no further type children) — e.g. Round Coin 圜钱.
 */
export function isTypologyLeafSelection(sel: TypologyFilterSelection): boolean {
  const { l1, l2, l3, l4 } = resolveTypologyPath(sel)
  if (!l1) return false
  if (l4 || l3) return true
  if (l2) return (l2.children?.length ?? 0) === 0
  return (l1.children?.length ?? 0) === 0
}

export function hasTypologyFilter(sel: TypologyFilterSelection): boolean {
  return !!sel.l1
}

function coinTypeLabels(coin: Pick<CoinType, 'major_type_zh' | 'minor_type_zh'>): string[] {
  return [coin.major_type_zh, coin.minor_type_zh]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
}

export function coinMatchesTypologyFilter(coin: CoinType, sel: TypologyFilterSelection): boolean {
  if (!sel.l1) return false

  const { l1 } = resolveTypologyPath(sel)
  if (!l1) return false

  const matchLabels = collectMatchLabels(sel)
  if (matchLabels.size === 0) return false

  const typeOk = coinTypeLabels(coin).some((label) => {
    if (matchLabels.has(label)) return true
    return matchLabels.has(normalizeLabel(label))
  })
  if (!typeOk) return false

  if (sel.inscription) {
    return (coin.inscription ?? '').trim() === sel.inscription
  }

  return true
}

/** Returns matching coin_type_codes, or null when no typology filter is active. */
export function getMatchingCoinTypeCodes(
  coinTypes: CoinType[],
  sel: TypologyFilterSelection
): Set<string> | null {
  if (!hasTypologyFilter(sel)) return null
  return new Set(
    coinTypes.filter((c) => coinMatchesTypologyFilter(c, sel)).map((c) => c.coin_type_code)
  )
}

/** Site-aggregate match for the homepage CoinFilterMap (CSV fields on MapSite). */
export function siteMatchesTypologyFilter(
  site: {
    major_types_zh: string | null
    minor_types_zh: string | null
    inscriptions: string | null
  },
  sel: TypologyFilterSelection
): boolean {
  if (!sel.l1) return false
  const { l1 } = resolveTypologyPath(sel)
  if (!l1) return false

  const matchLabels = collectMatchLabels(sel)
  const siteLabels = [...splitCsv(site.major_types_zh), ...splitCsv(site.minor_types_zh)]
  const typeOk = siteLabels.some(
    (label) => matchLabels.has(label) || matchLabels.has(normalizeLabel(label))
  )
  if (!typeOk) return false

  if (sel.inscription) {
    return splitCsv(site.inscriptions).includes(sel.inscription)
  }
  return true
}

export function optionLabel(en: string, zh: string, lang: 'en' | 'zh'): string {
  if (lang === 'zh' && zh) return zh
  if (en && zh) return `${en} · ${zh}`
  return en || zh
}

export function getL1Options(lang: 'en' | 'zh') {
  return TYPOLOGY.map((l1) => ({
    value: l1.label_en,
    label: optionLabel(l1.label_en, l1.label_zh, lang),
  }))
}

export function getL2Options(sel: TypologyFilterSelection, lang: 'en' | 'zh') {
  const { l1 } = resolveTypologyPath(sel)
  return (l1?.children ?? []).map((l2) => ({
    value: l2.label_en,
    label: optionLabel(l2.label_en, l2.label_zh, lang),
  }))
}

export function getL3Options(sel: TypologyFilterSelection, lang: 'en' | 'zh') {
  const { l2 } = resolveTypologyPath(sel)
  return (l2?.children ?? []).map((l3) => ({
    value: l3.label_en,
    label: optionLabel(l3.label_en, l3.label_zh, lang),
  }))
}

export function getL4Options(sel: TypologyFilterSelection, lang: 'en' | 'zh') {
  const { l3 } = resolveTypologyPath(sel)
  return (l3?.children ?? []).map((l4) => ({
    value: l4.label_en,
    label: optionLabel(l4.label_en, l4.label_zh, lang),
  }))
}

export type InscriptionOption = {
  zh: string
  en: string
  mint_zh: string | null
}

/**
 * Inscription choices for the current typology selection.
 * Falls back to DB coin_types when Typology.xlsx has no entries for this branch
 * (e.g. Round Coin 圜钱 is an L1 leaf with no 国别判断 rows).
 */
export function getInscriptionOptions(
  sel: TypologyFilterSelection,
  coinTypes?: CoinType[]
): InscriptionOption[] {
  const seen = new Set<string>()
  const fromTypology = getInscriptionEntries(sel)
    .filter((e) => e.inscription_zh)
    .filter((e) => {
      if (seen.has(e.inscription_zh!)) return false
      seen.add(e.inscription_zh!)
      return true
    })
    .map((e) => ({
      zh: e.inscription_zh!,
      en: e.inscription_en ?? e.inscription_zh!,
      mint_zh: e.mint_zh,
    }))

  if (fromTypology.length > 0 || !coinTypes?.length || !sel.l1) return fromTypology

  // Type-only match (ignore inscription) so the list covers the whole selection
  const typeOnly: TypologyFilterSelection = { ...sel, inscription: '' }
  const fromDb: InscriptionOption[] = []
  coinTypes.forEach((coin) => {
    if (!coinMatchesTypologyFilter(coin, typeOnly)) return
    const zh = (coin.inscription ?? '').trim()
    if (!zh || seen.has(zh)) return
    seen.add(zh)
    fromDb.push({
      zh,
      en: (coin.inscription_en ?? zh).trim() || zh,
      mint_zh: coin.mint_zh,
    })
  })
  return fromDb.sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))
}

/** Deepest selected typology node label for display. */
export function selectedTypologyLabel(sel: TypologyFilterSelection, lang: 'en' | 'zh'): string | null {
  const { l1, l2, l3, l4 } = resolveTypologyPath(sel)
  if (sel.inscription) return sel.inscription
  if (l4) return optionLabel(l4.label_en, l4.label_zh, lang)
  if (l3) return optionLabel(l3.label_en, l3.label_zh, lang)
  if (l2) return optionLabel(l2.label_en, l2.label_zh, lang)
  if (l1) return optionLabel(l1.label_en, l1.label_zh, lang)
  return null
}
