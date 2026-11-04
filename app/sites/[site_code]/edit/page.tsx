import { redirect } from 'next/navigation'
import { SiteDetailContent } from '@/components/site/SiteDetailContent'
import { isAuthorized } from '@/lib/admin/guard'
import { getSite } from '@/lib/queries'

type PageProps = {
  params: Promise<{ site_code: string }>
}

// The only place on this route tree that reads cookies()/isAuthorized() —
// keeping it out of app/sites/[site_code]/page.tsx is what lets that public
// route stay statically cacheable. Same content as the public page (shared
// via SiteDetailContent), just with authorized=true so edit affordances
// render; an unauthenticated visit bounces straight back to the public URL.

export async function generateMetadata({ params }: PageProps) {
  const { site_code } = await params
  const site = await getSite(site_code)
  if (!site) return { title: 'Site not found / 未找到该遗址' }
  return { title: `Edit — ${site.site_name_zh ?? site_code} | Early Chinese Coin Finds` }
}

export default async function SiteEditPage({ params }: PageProps) {
  const { site_code } = await params
  if (!(await isAuthorized())) redirect(`/sites/${site_code}`)
  return <SiteDetailContent site_code={site_code} authorized />
}
