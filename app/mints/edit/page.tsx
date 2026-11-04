import { redirect } from 'next/navigation'
import { MintsPageContent } from '@/components/mints/MintsPageContent'
import { isAuthorized } from '@/lib/admin/guard'

export const metadata = {
  title: 'Edit Mints | Early Chinese Coin Finds',
}

// The only place on this route tree that reads cookies()/isAuthorized() —
// keeping it out of app/mints/page.tsx is what lets that public route stay
// statically cacheable. Same content as the public page (shared via
// MintsPageContent), just with authorized=true so edit affordances render;
// an unauthenticated visit bounces straight back to the public URL.
export default async function MintsEditPage() {
  if (!(await isAuthorized())) redirect('/mints')
  return <MintsPageContent authorized />
}
