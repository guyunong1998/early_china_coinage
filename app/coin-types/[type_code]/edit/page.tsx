import { redirect } from 'next/navigation'
import { CoinTypeDetailContent } from '@/components/coin-types/CoinTypeDetailContent'
import { isAuthorized } from '@/lib/admin/guard'
import { buildCoinTypeNodes } from '@/lib/coin-type-catalog'
import { getCoinTypeByCode } from '@/lib/queries'

type PageProps = {
  params: Promise<{ type_code: string }>
}

// The only place on this route tree that reads cookies()/isAuthorized() —
// keeping it out of app/coin-types/[type_code]/page.tsx is what lets that
// public route stay statically cacheable. Same content as the public page
// (shared via CoinTypeDetailContent), just with authorized=true so edit
// affordances render; an unauthenticated visit bounces straight back to the
// public URL.

export async function generateMetadata({ params }: PageProps) {
  const { type_code } = await params
  const row = await getCoinTypeByCode(type_code)
  if (!row) return { title: 'Not found / 未找到' }
  const node = buildCoinTypeNodes([row], []).find((n) => n.ownHierarchyId === row.id)
  if (!node) return { title: 'Not found / 未找到' }
  return { title: `Edit — ${node.label_zh} ${node.label_en} | Coin Types` }
}

export default async function CoinTypeEditPage({ params }: PageProps) {
  const { type_code } = await params
  if (!(await isAuthorized())) redirect(`/coin-types/${type_code}`)
  return <CoinTypeDetailContent type_code={type_code} authorized />
}
