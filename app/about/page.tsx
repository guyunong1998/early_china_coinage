import Image from 'next/image'
import { DataCard } from '@/components/ui/DataCard'
import { T } from '@/components/i18n/T'

const GITHUB_URL = 'https://github.com/guyunong1998/early_china_coinage'

type TeamMember = {
  name: string
  title: string
  affiliation: string
  email: string
  photo: string
  /** The cropped photo's own pixel dimensions -- cropped to its non-transparent
   * content only (see scripts/ or the crop step itself), never further cropped
   * on display, so next/image needs its real aspect ratio here. */
  photoWidth: number
  photoHeight: number
}

// title/affiliation/email left blank on purpose — edit these in place once
// they're final, rather than waiting on a placeholder string.
const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Yunong Gu',
    title: '',
    affiliation: '',
    email: '',
    photo: '/images/yunong-cropped.png',
    photoWidth: 1105,
    photoHeight: 2053,
  },
  {
    name: 'Sophia Ling',
    title: '',
    affiliation: '',
    email: '',
    photo: '/images/sophia-cropped.png',
    photoWidth: 1106,
    photoHeight: 2047,
  },
]

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
          <div className="relative mt-3 aspect-[1941/1065] w-full overflow-hidden rounded border border-brand/15 bg-white">
            <Image
              src="/images/database_schema.png"
              alt="Database schema"
              fill
              sizes="(min-width: 1024px) 768px, 100vw"
              className="object-contain"
            />
          </div>
        </DataCard>

        <DataCard title={<T k="about.team.title" />}>
          <p className="text-sm leading-7 text-gray-700">
            {/* <T k="about.team.body" /> */}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {TEAM_MEMBERS.map((member) => (
              <div key={member.name} className="panel flex flex-col items-center p-5 text-center">
                <Image
                  src={member.photo}
                  alt={member.name}
                  width={member.photoWidth}
                  height={member.photoHeight}
                  className="h-48 w-auto rounded-lg border-brand/15"
                />
                <h3 className="mt-3 font-serif text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="mt-1 min-h-[1.25rem] text-sm text-gray-600">{member.title}</p>
                <p className="mt-0.5 min-h-[1.25rem] text-sm text-gray-500">{member.affiliation}</p>
                {member.email ? (
                  <a href={`mailto:${member.email}`} className="mt-1.5 text-sm text-brand hover:underline">
                    {member.email}
                  </a>
                ) : (
                  <p className="mt-1.5 min-h-[1.25rem] text-sm text-brand">&nbsp;</p>
                )}
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
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
          >
            <T k="about.resources.github" /> →
          </a>
        </DataCard>
      </div>
    </div>
  )
}
