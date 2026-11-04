import { redirect } from 'next/navigation'
import { SourcesPageContent } from '@/components/sources/SourcesPageContent'
import { isAuthorized } from '@/lib/admin/guard'

export const metadata = {
  title: 'Edit Sources | Early Chinese Coin Finds',
}

// The only place on this route tree that reads cookies()/isAuthorized() —
// keeping it out of app/sources/page.tsx is what lets that public route
// stay statically cacheable. Same content as the public page (shared via
// SourcesPageContent), just with authorized=true so edit affordances
// render; an unauthenticated visit bounces straight back to the public URL.
export default async function SourcesEditPage() {
  if (!(await isAuthorized())) redirect('/sources')
  return <SourcesPageContent authorized />
}
