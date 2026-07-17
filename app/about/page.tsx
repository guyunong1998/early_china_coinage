import { DataCard } from '@/components/ui/DataCard'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { T } from '@/components/i18n/T'

const GITHUB_URL = 'https://github.com/guyunong1998/early_china_coinage'
const TEAM_MEMBERS = [{ name: 'Yunong Gu' }, { name: 'Sophia Ling' }]

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
          <p className="text-sm leading-7 text-gray-700 mt-4">
            <T k="about.functions.body" />
          </p>
        </DataCard>


        <DataCard title={<T k="about.schema.title" />}>
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.schema.body" />
          </p>
          <ImagePlaceholder label={<T k="about.schema.imageLabel" />} className="mt-3 h-64 w-full rounded" />
        </DataCard>

        <DataCard title={<T k="about.team.title" />}>
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.team.body" />
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {TEAM_MEMBERS.map((member) => (
              <div key={member.name} className="panel flex flex-col items-center p-5 text-center">
                <ImagePlaceholder
                  label={<T k="about.team.portraitPlaceholder" />}
                  className="h-32 w-32 rounded-full"
                />
                <h3 className="mt-3 font-serif text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="mt-1 text-sm text-gray-400">
                  <T k="about.team.titlePlaceholder" />
                </p>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title={<T k="about.collab.title" />} id="collaborations">
          <p className="text-sm leading-7 text-gray-700">
            <T k="about.collab.body" />
          </p>
        </DataCard>

        <DataCard title={<T k="about.resources.title" />}>
          <ul className="space-y-1.5 text-sm text-gray-700">
            <li>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                <T k="about.resources.github" />
              </a>
            </li>
          </ul>
        </DataCard>
      </div>
    </div>
  )
}
