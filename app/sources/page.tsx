import { SourcesPageContent } from '@/components/sources/SourcesPageContent'

export const metadata = {
  title: 'Sources | Early Chinese Coin Finds',
  description: 'Bibliographic sources cited across sites, contexts, finds, and museum specimens.',
}

// Public view — never calls isAuthorized()/cookies(), so this stays
// ISR-eligible. Editing lives at /sources/edit instead of behind an inline
// authorized check here (see that route for why).
export const revalidate = 86400

export default async function SourcesPage() {
  return <SourcesPageContent authorized={false} />
}
