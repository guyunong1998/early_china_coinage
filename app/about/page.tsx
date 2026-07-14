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

        <DataCard title={<T k="about.team.title" />} id="team">
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.team.body" />
          </p>
        </DataCard>

        <DataCard title={<T k="about.collab.title" />} id="collaborations">
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.collab.body" />
          </p>
        </DataCard>
      </div>
    </div>
  )
}
