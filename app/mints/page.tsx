import { MintsPageContent } from '@/components/mints/MintsPageContent'

export const metadata = {
  title: 'Mint Town Locations | Early Chinese Coin Finds',
  description: 'Browse and search recorded coin-producing centres of pre-Qin and early Han China.',
}

// Public view — never calls isAuthorized()/cookies(), so this stays
// ISR-eligible. Editing lives at /mints/edit instead of behind an inline
// authorized check here (see that route for why).
export const revalidate = 86400

export default async function MintsPage() {
  return <MintsPageContent authorized={false} />
}
