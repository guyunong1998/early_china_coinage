import Link from 'next/link'
import { DataCard } from '@/components/ui/DataCard'
import { T } from '@/components/i18n/T'

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-3xl font-semibold text-brand">
        <T k="about.title" />
      </h1>
      <p className="mt-4 text-gray-700 leading-7">
        <T k="about.intro" />
      </p>

      <div className="mt-8 space-y-6">
        <DataCard title={<T k="about.scope.title" />}>
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.scope.body" />
          </p>
        </DataCard>

        <DataCard title={<T k="about.collab.title" />} id="collaborations">
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.collab.body" />
          </p>
        </DataCard>

        <div className="panel-nav-card px-5 py-4">
          <h2 className="font-serif text-sm font-semibold text-gray-900">
            <T k="about.team.title" />
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            <T k="about.team.teaser" />
          </p>
          <Link
            href="/about/team"
            className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
          >
            <T k="about.team.linkLabel" /> →
          </Link>
        </div>
      </div>
    </div>
  )
}
