import { MintDetailContent, resolveMintPage } from '@/components/mints/MintDetailContent'
import { getMints } from '@/lib/queries'

type PageProps = {
  params: Promise<{ mint_code: string }>
}

// Public view — never calls isAuthorized()/cookies(), so this stays
// ISR-eligible. Editing lives at /mints/[mint_code]/edit instead of behind
// an inline authorized check here (see that route for why).
//
// generateStaticParams prerenders every mint (126 rows, same scale as
// /coin-types/[type_code]'s 72) so each is actually served from the Full
// Route Cache rather than rendered dynamically forever — see the comment on
// app/coin-types/[type_code]/page.tsx for why this is required, not optional.

export const revalidate = 86400

export async function generateStaticParams() {
  const mints = await getMints()
  return mints.map((m) => ({ mint_code: m.mint_code }))
}

export async function generateMetadata({ params }: PageProps) {
  const { mint_code } = await params
  const { mint } = await resolveMintPage(mint_code)
  if (!mint) return { title: 'Not found' }
  return {
    title: `${mint.name_zh} ${mint.name_en} | Mint Town Locations`,
    description: mint.description_zh ?? mint.description_en,
  }
}

export default async function MintDetailPage({ params }: PageProps) {
  const { mint_code } = await params
  return <MintDetailContent mint_code={mint_code} authorized={false} />
}
