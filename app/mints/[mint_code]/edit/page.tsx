import { redirect } from 'next/navigation'
import { MintDetailContent, resolveMintPage } from '@/components/mints/MintDetailContent'
import { isAuthorized } from '@/lib/admin/guard'

type PageProps = {
  params: Promise<{ mint_code: string }>
}

// The only place on this route tree that reads cookies()/isAuthorized() —
// keeping it out of app/mints/[mint_code]/page.tsx is what lets that public
// route stay statically cacheable. Same content as the public page (shared
// via MintDetailContent), just with authorized=true so edit affordances
// render; an unauthenticated visit bounces straight back to the public URL.

export async function generateMetadata({ params }: PageProps) {
  const { mint_code } = await params
  const { mint } = await resolveMintPage(mint_code)
  if (!mint) return { title: 'Not found' }
  return { title: `Edit — ${mint.name_zh} ${mint.name_en} | Mint Town Locations` }
}

export default async function MintEditPage({ params }: PageProps) {
  const { mint_code } = await params
  if (!(await isAuthorized())) redirect(`/mints/${mint_code}`)
  return <MintDetailContent mint_code={mint_code} authorized />
}
