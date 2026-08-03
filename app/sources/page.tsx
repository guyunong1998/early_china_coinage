import { SourcesListClient } from '@/components/sources/SourcesListClient'
import { isAuthorized } from '@/lib/admin/guard'
import { resolveSourceLinkTargets } from '@/lib/admin/resolve-source-link-target'
import { getAllSourceLinks, getAllSources } from '@/lib/queries'

export const metadata = {
  title: 'Sources | Early Chinese Coin Finds',
  description: 'Bibliographic sources cited across sites, contexts, finds, and museum specimens.',
}

export default async function SourcesPage() {
  const [sources, links] = await Promise.all([getAllSources(), getAllSourceLinks()])
  const resolved = await resolveSourceLinkTargets(links)
  const authorized = await isAuthorized()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Sources</h1>
        <p className="mt-1 text-sm text-gray-500">
          {sources.length} catalogued sources, {links.length} linked citations across sites, contexts, finds, and
          museum specimens.
        </p>
      </div>

      <SourcesListClient initialSources={sources} initialLinks={links} initialResolved={resolved} isDevMode={authorized} />
    </div>
  )
}
