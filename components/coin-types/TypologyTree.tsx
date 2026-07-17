import Link from 'next/link'
import { COIN_TYPE_NODES, type CoinTypeLevel, type CoinTypeNode } from '@/lib/coin-type-catalog'

const CHILD_LEVEL: Partial<Record<CoinTypeLevel, CoinTypeLevel>> = {
  l1: 'l2',
  l2: 'l3',
  l3: 'l4',
}

function childrenOf(parent: CoinTypeNode | null): CoinTypeNode[] {
  if (!parent) return COIN_TYPE_NODES.filter((n) => n.level === 'l1')
  const childLevel = CHILD_LEVEL[parent.level]
  if (!childLevel) return []
  return COIN_TYPE_NODES.filter((n) => n.level === childLevel && n.parents[n.parents.length - 1]?.slug === parent.slug)
}

function TreeNode({
  node,
  currentSlug,
  expandedSlugs,
}: {
  node: CoinTypeNode
  currentSlug: string
  expandedSlugs: Set<string>
}) {
  const children = childrenOf(node)
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
      <summary className="cursor-pointer list-outside py-0.5 marker:text-brand/50">{label}</summary>
      <div className="ml-4 border-l border-brand/10 pl-3">
        {children.map((child) => (
          <TreeNode key={child.slug} node={child} currentSlug={currentSlug} expandedSlugs={expandedSlugs} />
        ))}
      </div>
    </details>
  )
}

/**
 * Full L1–L4 typology hierarchy as a nested accordion (native `<details>`,
 * no client JS needed) — every ancestor of `currentSlug` starts expanded so
 * the current type's place in the tree is immediately visible; every other
 * branch starts collapsed.
 */
export function TypologyTree({ currentSlug }: { currentSlug: string }) {
  const current = COIN_TYPE_NODES.find((n) => n.slug === currentSlug)
  const expandedSlugs = new Set(current?.parents.map((p) => p.slug) ?? [])
  if (current) expandedSlugs.add(current.slug)

  return (
    <div>
      {childrenOf(null).map((l1) => (
        <TreeNode key={l1.slug} node={l1} currentSlug={currentSlug} expandedSlugs={expandedSlugs} />
      ))}
    </div>
  )
}
