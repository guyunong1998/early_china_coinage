import { SiteDetailContent } from '@/components/site/SiteDetailContent'
import { getSite } from '@/lib/queries'

type PageProps = {
  params: Promise<{ site_code: string }>
}

// Public view — never calls isAuthorized()/cookies(), so this stays
// ISR-eligible. Editing lives at /sites/[site_code]/edit instead of behind
// an inline authorized check here (see that route for why).
//
// generateStaticParams returns [] on purpose: unlike /coin-types/[type_code]
// and /mints/[mint_code], nothing is prerendered at build — this table has
// ~1,830 rows, and each site's content issues up to ~9 sequential Supabase
// queries, so prerendering all of them would cost ~16,000+ DB round trips
// per build. But the export itself is required: without generateStaticParams
// the App Router treats this dynamic segment as fully dynamic (`ƒ`, every
// request `no-store`, verified with next build + next start). With [], each
// site renders on its first visit and is then served from the Full Route
// Cache for `revalidate`; unknown codes still 404. Admin edits already call
// revalidatePath('/sites/[site_code]', 'page'), so they show up immediately.

export const revalidate = 86400

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: PageProps) {
  const { site_code } = await params
  const site = await getSite(site_code)
  if (!site) return { title: 'Site not found / 未找到该遗址' }
  return {
    title: `${site.site_name_zh ?? site_code} | Early Chinese Coin Finds`,
    description: site.description_en ?? site.description_zh ?? undefined,
  }
}

export default async function SitePage({ params }: PageProps) {
  const { site_code } = await params
  return <SiteDetailContent site_code={site_code} authorized={false} />
}
