import { SourcesListClient } from '@/components/sources/SourcesListClient'
import { T } from '@/components/i18n/T'
import { isAuthorized } from '@/lib/admin/guard'
import { resolveSourceLinkTargets } from '@/lib/admin/resolve-source-link-target'
import { getAllSourceLinks, getAllSources } from '@/lib/queries'

export const metadata = {
  title: 'Sources | Early Chinese Coin Finds',
  description: 'Bibliographic sources cited across sites, contexts, finds, and museum specimens.',
}

export const revalidate = 86400

export default async function SourcesPage() {
  const [sources, links] = await Promise.all([getAllSources(), getAllSourceLinks()])
  const resolved = await resolveSourceLinkTargets(links)
  const authorized = await isAuthorized()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">
          <T k="sources.title" />
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          <T k="sources.summary" vars={{ sources: sources.length, links: links.length }} />
        </p>
      </div>

      <SourcesListClient initialSources={sources} initialLinks={links} initialResolved={resolved} isDevMode={authorized} />
    </div>
  )
}
