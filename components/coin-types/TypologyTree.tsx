import Link from 'next/link'
import type { CoinTypeLevel, CoinTypeNode } from '@/lib/coin-type-catalog'

const CHILD_LEVEL: Partial<Record<CoinTypeLevel, CoinTypeLevel>> = {
  level1: 'level2',
  level2: 'level3',
  level3: 'level4',
  level4: 'level5',
}

function childrenOf(nodes: CoinTypeNode[], parent: CoinTypeNode): CoinTypeNode[] {
  const childLevel = CHILD_LEVEL[parent.level]
  if (!childLevel) return []
  return nodes.filter((n) => n.level === childLevel && n.parents[n.parents.length - 1]?.slug === parent.slug)
}

/** The current node's own level2 ancestor (parents are root-first, so
 * parents[1] is level2 for a level3+ node) — or the node itself when it IS
 * a level2 node. level1 nodes have no level2 to show. */
function level2AncestorSlug(node: CoinTypeNode): string | undefined {
  if (node.level === 'level1') return undefined
  if (node.level === 'level2') return node.slug
  return node.parents[1]?.slug
}

function TreeNode({
  nodes,
  node,
  currentSlug,
  expandedSlugs,
}: {
  nodes: CoinTypeNode[]
  node: CoinTypeNode
  currentSlug: string
  expandedSlugs: Set<string>
}) {
  const children = childrenOf(nodes, node)
  const isCurrent = node.slug === currentSlug

  const label = (
    <Link
      href={`/coin-types/${node.slug}`}
      className={`text-sm hover:underline ${isCurrent ? 'font-bold text-brand' : 'text-gray-700 hover:text-brand'}`}
    >
      {node.label_zh} <span className="text-xs italic text-gray-400">({node.label_en})</span>
    </Link>
  )

  if (children.length === 0) {
    return <div className="py-1 pl-5">{label}</div>
  }

  return (
    <details open={expandedSlugs.has(node.slug)} className="py-0.5">
      <summary className="cursor-pointer list-outside py-0.5 pl-5 marker:text-brand/50">{label}</summary>
      <div className="ml-4 border-l border-brand/10 pl-3">
        {children.map((child) => (
          <TreeNode key={child.slug} nodes={nodes} node={child} currentSlug={currentSlug} expandedSlugs={expandedSlugs} />
        ))}
      </div>
    </details>
  )
}

/**
 * Just the current node's own branch of the typology hierarchy — its level2
 * ancestor and every descendant — as a nested accordion (native `<details>`,
 * no client JS needed). Not the whole forest: level1 (钱币 vs 钱范) is a
 * matching/grouping concept, not a browsable page, and showing every other
 * level2 category here would bury the current node's own branch among
 * unrelated siblings. Every ancestor of `currentSlug` starts expanded, so
 * viewing a level2 page itself shows that branch already expanded one layer
 * (its level3 children visible); every deeper, unrelated branch starts
 * collapsed.
 */
export function TypologyTree({ nodes, currentSlug }: { nodes: CoinTypeNode[]; currentSlug: string }) {
  const current = nodes.find((n) => n.slug === currentSlug)
  const expandedSlugs = new Set(current?.parents.map((p) => p.slug) ?? [])
  if (current) expandedSlugs.add(current.slug)

  const rootSlug = current && level2AncestorSlug(current)
  const root = rootSlug ? nodes.find((n) => n.slug === rootSlug) : undefined
  if (!root) return null

  return (
    <div>
      <TreeNode nodes={nodes} node={root} currentSlug={currentSlug} expandedSlugs={expandedSlugs} />
    </div>
  )
}

/**
 * The whole typology forest — both level1 roots (钱币 "Coin" and 钱范 "Mould")
 * with every descendant — for the coin-types index page, where (unlike the
 * detail page's single-branch TypologyTree) there's no one current node to
 * scope down to. Both roots start expanded so their level2 categories are
 * visible on load; everything deeper starts collapsed, same as the
 * single-branch view, so this doesn't dump hundreds of rows on first paint.
 */
export function FullTypologyTree({ nodes }: { nodes: CoinTypeNode[] }) {
  const roots = nodes
    .filter((n) => n.level === 'level1')
    .sort((a, b) => a.label_zh.localeCompare(b.label_zh, 'zh-CN'))
  const expandedSlugs = new Set(roots.map((r) => r.slug))

  return (
    <div className="text-base">
      {roots.map((root) => (
        <TreeNode key={root.slug} nodes={nodes} node={root} currentSlug="" expandedSlugs={expandedSlugs} />
      ))}
    </div>
  )
}
