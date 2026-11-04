import { CoinTypeDetailContent } from '@/components/coin-types/CoinTypeDetailContent'
import { buildCoinTypeNodes } from '@/lib/coin-type-catalog'
import { getCoinTypeByCode, getCoinTypeHierarchy } from '@/lib/queries'

type PageProps = {
  params: Promise<{ type_code: string }>
}

// Public view — never calls isAuthorized()/cookies(), so this stays
// ISR-eligible. Editing lives at /coin-types/[type_code]/edit instead of
// behind an inline authorized check here (see that route for why).
//
// generateStaticParams is required, not optional, for that to actually take
// effect: in the App Router, a dynamic segment outside generateStaticParams'
// returned list renders fully dynamically on every request forever (verified
// against a real `next start` — Cache-Control stayed no-store on repeat hits
// without this), unlike Pages Router's fallback:'blocking', which cached
// after the first on-demand render. Removing isAuthorized() alone was not
// enough; this restores the generateStaticParams this page had before the
// auth check was added (see git history) so every type_code is prerendered
// at build time and served from the Full Route Cache after that.

export const revalidate = 86400

export async function generateStaticParams() {
  const hierarchyRows = await getCoinTypeHierarchy()
  // Every row's own type_code — level1 (钱币/钱范) has none and is
  // deliberately excluded (see app/coin-types/page.tsx: "a matching/grouping
  // concept, not a browsable card"), so this no longer prerenders those two
  // unlinked pages the old slug-based version did.
  return hierarchyRows.map((r) => ({ type_code: r.type_code }))
}

export async function generateMetadata({ params }: PageProps) {
  const { type_code } = await params
  const row = await getCoinTypeByCode(type_code)
  if (!row) return { title: 'Not found / 未找到' }
  // Scoped to this one row instead of building the whole hierarchy tree just
  // to read one node's label — buildCoinTypeNodes works the same over a
  // single-row array, producing that row's own node (matched below by
  // ownHierarchyId) with label_zh/label_en already resolved.
  const node = buildCoinTypeNodes([row], []).find((n) => n.ownHierarchyId === row.id)
  if (!node) return { title: 'Not found / 未找到' }
  return {
    title: `${node.label_zh} ${node.label_en} | Coin Types`,
    description: `${node.label_en} (${node.label_zh}) — typology, related finds, inscriptions, and mints.`,
  }
}

export default async function CoinTypeDetailPage({ params }: PageProps) {
  const { type_code } = await params
  return <CoinTypeDetailContent type_code={type_code} authorized={false} />
}
