import Link from 'next/link'
import { SourcesListClient } from '@/components/sources/SourcesListClient'
import { T } from '@/components/i18n/T'
import { resolveSourceLinkTargets } from '@/lib/admin/resolve-source-link-target'
import { getAllSourceLinks, getAllSources } from '@/lib/queries'

/**
 * Shared render body for `/sources` (public, `authorized` always false so
 * this never touches `cookies()` and stays ISR-eligible) and `/sources/edit`
 * (checks the real session, redirects back to the public URL if not an
 * admin).
 */
export async function SourcesPageContent({ authorized }: { authorized: boolean }) {
  const [sources, links] = await Promise.all([getAllSources(), getAllSourceLinks()])
  const resolved = await resolveSourceLinkTargets(links)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-gray-900">
            <T k="sources.title" />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            <T k="sources.summary" vars={{ sources: sources.length, links: links.length }} />
          </p>
        </div>
        {!authorized && (
          <Link href="/sources/edit" className="text-sm text-brand hover:underline">
            Edit
          </Link>
        )}
      </div>

      <SourcesListClient initialSources={sources} initialLinks={links} initialResolved={resolved} isDevMode={authorized} />
    </div>
  )
}
