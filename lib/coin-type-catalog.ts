import type { CoinIssueDisplay, CoinTypeHierarchyRow, HeatmapFind } from '@/lib/types'

export type CoinTypeLevel = 'level1' | 'level2' | 'level3' | 'level4' | 'level5'

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
  /** Root first, immediate parent last. Empty for level1 nodes. */
  parents: CoinTypeParentRef[]
  /** Every coin_type_hierarchy row id that belongs under this node — its own
   * generic-bucket row (if one exists) plus every deeper descendant. Feed
   * straight into computeCoinTypeCounts. */
  matchedHierarchyIds: string[]
  states: StateRef[]
  mints: MintRef[]
  inscriptions: InscriptionRef[]
  /** img_acc_num from this node's own row (the one that doesn't subdivide
   * any further), if a specimen was photographed for it — never sourced
   * from a deeper descendant's row. */
  imgAccNum: string | null
}

const LEVELS: CoinTypeLevel[] = ['level1', 'level2', 'level3', 'level4', 'level5']

function zhOf(row: CoinTypeHierarchyRow, level: CoinTypeLevel): string | null {
  return row[`${level}_zh` as const]
}

function enOf(row: CoinTypeHierarchyRow, level: CoinTypeLevel): string | null {
  return row[`${level}_en` as const]
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'type'
  )
}

function uniqueSlug(candidate: string, used: Set<string>, fallbackPrefix: string): string {
  if (!used.has(candidate)) return candidate
  const prefixed = `${fallbackPrefix}-${candidate}`
  if (!used.has(prefixed)) return prefixed
  let i = 2
  while (used.has(`${prefixed}-${i}`)) i++
  return `${prefixed}-${i}`
}

function dedupeStates(coinIssues: CoinIssueDisplay[], hierarchyIds: Set<string>): StateRef[] {
  const seen = new Map<string, StateRef>()
  coinIssues.forEach((c) => {
    if (!c.coin_type_hierarchy_id || !hierarchyIds.has(c.coin_type_hierarchy_id)) return
    const zh = c.state_zh?.trim()
    if (!zh || seen.has(zh)) return
    seen.set(zh, { state_zh: zh, state_en: c.state_en })
  })
  return [...seen.values()].sort((a, b) => a.state_zh.localeCompare(b.state_zh, 'zh-CN'))
}

function dedupeMints(coinIssues: CoinIssueDisplay[], hierarchyIds: Set<string>): MintRef[] {
  const seen = new Map<string, MintRef>()
  coinIssues.forEach((c) => {
    if (!c.coin_type_hierarchy_id || !hierarchyIds.has(c.coin_type_hierarchy_id)) return
    const zh = c.mint_zh?.trim()
    if (!zh || seen.has(zh)) return
    seen.set(zh, { mint_zh: zh, mint_en: c.mint_en })
  })
  return [...seen.values()].sort((a, b) => a.mint_zh.localeCompare(b.mint_zh, 'zh-CN'))
}

/** img_acc_num from the row(s) that terminate exactly at this level — i.e.
 * don't subdivide further — as opposed to a deeper descendant's row that
 * happens to share `group.rows` with this node. */
function ownImgAccNum(rows: CoinTypeHierarchyRow[], depthIndex: number): string | null {
  const nextLevel = LEVELS[depthIndex + 1]
  const ownRows = nextLevel ? rows.filter((r) => !zhOf(r, nextLevel)) : rows
  return ownRows.find((r) => r.img_acc_num)?.img_acc_num ?? null
}

function dedupeInscriptions(coinIssues: CoinIssueDisplay[], hierarchyIds: Set<string>): InscriptionRef[] {
  const seen = new Map<string, InscriptionRef>()
  coinIssues.forEach((c) => {
    if (!c.coin_type_hierarchy_id || !hierarchyIds.has(c.coin_type_hierarchy_id)) return
    const zh = c.inscription?.trim()
    if (!zh || seen.has(zh)) return
    seen.set(zh, { inscription_zh: zh, inscription_en: c.inscription_en, mint_zh: c.mint_zh })
  })
  return [...seen.values()].sort((a, b) => a.inscription_zh.localeCompare(b.inscription_zh, 'zh-CN'))
}

/**
 * Recursively groups hierarchy rows by each level in turn. A group's own
 * `rows` are exactly the hierarchy rows whose path starts with this node's
 * path (its own generic-bucket row, if one exists, plus every deeper
 * descendant) — the same prefix rule lib/typology-filter.ts uses for
 * matching, but computed once here via group-by rather than a per-row scan.
 */
function buildLevel(
  rows: CoinTypeHierarchyRow[],
  depthIndex: number,
  parents: CoinTypeParentRef[],
  used: Set<string>,
  coinIssues: CoinIssueDisplay[],
  nodes: CoinTypeNode[]
) {
  const level = LEVELS[depthIndex]
  const groups = new Map<string, { zh: string; en: string; rows: CoinTypeHierarchyRow[] }>()

  rows.forEach((row) => {
    const zh = zhOf(row, level)
    if (!zh) return
    const existing = groups.get(zh)
    if (existing) {
      existing.rows.push(row)
    } else {
      groups.set(zh, { zh, en: enOf(row, level) ?? zh, rows: [row] })
    }
  })

  ;[...groups.values()]
    .sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))
    .forEach((group) => {
      const fallbackPrefix = parents.length > 0 ? parents[parents.length - 1].slug : level
      const slug = uniqueSlug(slugify(group.en), used, fallbackPrefix)
      used.add(slug)

      const hierarchyIds = new Set(group.rows.map((r) => r.id))

      nodes.push({
        slug,
        level,
        label_zh: group.zh,
        label_en: group.en,
        parents: [...parents],
        matchedHierarchyIds: [...hierarchyIds],
        states: dedupeStates(coinIssues, hierarchyIds),
        mints: dedupeMints(coinIssues, hierarchyIds),
        inscriptions: dedupeInscriptions(coinIssues, hierarchyIds),
        imgAccNum: ownImgAccNum(group.rows, depthIndex),
      })

      if (depthIndex < LEVELS.length - 1) {
        const childParents = [...parents, { slug, label_zh: group.zh, label_en: group.en }]
        buildLevel(group.rows, depthIndex + 1, childParents, used, coinIssues, nodes)
      }
    })
}

/**
 * Every level1-level5 node in the live coin_type_hierarchy tree, flattened.
 * level1 branches include both '钱币' (ordinary coins) and '钱范' (coin
 * moulds) as siblings — see lib/typology-filter.ts's majorDepth for why
 * that distinction matters for matching.
 */
export function buildCoinTypeNodes(
  hierarchyRows: CoinTypeHierarchyRow[],
  coinIssues: CoinIssueDisplay[]
): CoinTypeNode[] {
  const nodes: CoinTypeNode[] = []
  const used = new Set<string>()
  buildLevel(hierarchyRows, 0, [], used, coinIssues, nodes)
  return nodes
}

export function getCoinTypeNodeBySlug(nodes: CoinTypeNode[], slug: string): CoinTypeNode | undefined {
  return nodes.find((n) => n.slug === slug)
}

/** True for a node under the '钱范' (Coin Mould) level1 branch, as opposed
 * to '钱币' (ordinary coins) — the real field MouldTag.tsx was waiting on. */
export function isMouldNode(node: CoinTypeNode): boolean {
  const rootLabel = node.level === 'level1' ? node.label_zh : node.parents[0]?.label_zh
  return rootLabel === '钱范'
}

export type CoinTypeCounts = {
  coinCount: number
  siteCount: number
  /** Number of individual find records (rows in `finds`) matched to this
   * node — distinct from `coinCount` (their summed quantity) and
   * `siteCount` (their distinct find sites). */
  findCount: number
  /** Number of distinct catalogued `coin_issues` rows under this node,
   * regardless of whether any find has been recorded against them yet. */
  issueCount: number
}

/** Total coin quantity + distinct find-site count for one typology node,
 * from the same raw finds/coinIssues data the Find Site map visualization
 * uses — so the numbers shown here always agree with what filtering to
 * this type on the map would show. */
export function computeCoinTypeCounts(
  matchedHierarchyIds: string[],
  finds: HeatmapFind[],
  hierarchyIdByIssueId: Map<string, string | null>
): CoinTypeCounts {
  const idSet = new Set(matchedHierarchyIds)
  let coinCount = 0
  let findCount = 0
  const sites = new Set<string>()
  finds.forEach((f) => {
    if (!f.coin_issues_id) return
    const hierarchyId = hierarchyIdByIssueId.get(f.coin_issues_id)
    if (!hierarchyId || !idSet.has(hierarchyId)) return
    coinCount += f.quantity_total ?? f.quantity_estimated ?? f.quantity_min ?? 0
    findCount += 1
    if (f.site_code) sites.add(f.site_code)
  })
  let issueCount = 0
  hierarchyIdByIssueId.forEach((hierarchyId) => {
    if (hierarchyId && idSet.has(hierarchyId)) issueCount += 1
  })
  return { coinCount, siteCount: sites.size, findCount, issueCount }
}

/** Counts for every node at once — one pass building a coin_issues.id →
 * coin_type_hierarchy_id lookup, then one pass over `finds` per node (a
 * hundred-some nodes × a few thousand finds is trivial server-side work,
 * no need for a fancier single-pass algorithm). */
export function computeAllCoinTypeCounts(
  nodes: CoinTypeNode[],
  finds: HeatmapFind[],
  coinIssues: CoinIssueDisplay[]
): Record<string, CoinTypeCounts> {
  const hierarchyIdByIssueId = new Map(coinIssues.map((c) => [c.id, c.coin_type_hierarchy_id]))
  const result: Record<string, CoinTypeCounts> = {}
  nodes.forEach((node) => {
    result[node.slug] = computeCoinTypeCounts(node.matchedHierarchyIds, finds, hierarchyIdByIssueId)
  })
  return result
}
