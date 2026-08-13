import Image from 'next/image'
import Link from 'next/link'
import { AuthStatus } from '@/components/auth/AuthStatus'
import { DataCard } from '@/components/ui/DataCard'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

const GITHUB_URL = 'https://github.com/guyunong1998/early_china_coinage'

type TeamMember = {
  name: string
  title: string
  affiliation: string
  email: string
  photo: string
}

type SiteFunction = {
  href: string
  labelKey: DictionaryKey
  descKey: DictionaryKey
}

const SITE_FUNCTIONS: SiteFunction[] = [
  { href: '/mints', labelKey: 'about.usage.mints.label', descKey: 'about.usage.mints.desc' },
  { href: '/coin-types', labelKey: 'about.usage.coinTypes.label', descKey: 'about.usage.coinTypes.desc' },
  { href: '/museum-collections', labelKey: 'about.usage.museum.label', descKey: 'about.usage.museum.desc' },
  { href: '/visualizations', labelKey: 'about.usage.map.label', descKey: 'about.usage.map.desc' },
  { href: '/search', labelKey: 'about.usage.search.label', descKey: 'about.usage.search.desc' },
]

// title/affiliation/email left blank on purpose — edit these in place once
// they're final, rather than waiting on a placeholder string.
const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Yunong Gu',
    title: '',
    affiliation: 'Ph.D, UCLA',
    email: 'guyunong1998@g.ucla.edu',
    photo: '/images/yunong.jpg',
  },
  {
    name: 'Sophia Ling',
    title: '',
    affiliation: 'M.S, Columbia University',
    email: 'sl4909@columbia.edu',
    photo: '/images/sophia.jpg',
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
        <DataCard title={<T k="about.usage.title" />}>
          <div className="divide-y divide-brand/10">
            {SITE_FUNCTIONS.map((fn) => (
              <Link
                key={fn.href}
                href={fn.href}
                className="group flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span>
                  <span className="font-serif text-sm font-semibold text-brand group-hover:underline">
                    <T k={fn.labelKey} />
                  </span>
                  <span className="ml-2 text-sm text-gray-600">
                    <T k={fn.descKey} />
                  </span>
                </span>
                <span className="shrink-0 text-xs text-brand opacity-0 transition group-hover:opacity-100">→</span>
              </Link>
            ))}
          </div>
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
                <div className="relative h-48 w-48 overflow-hidden rounded-lg border border-brand/15">
                  <Image
                    src={member.photo}
                    alt={member.name}
                    fill
                    sizes="192px"
                    className="object-cover"
                  />
                </div>
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
          <div className="mt-2 flex flex-wrap gap-6">
            <a
              href="https://numismatics.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 transition hover:opacity-80"
            >
              <Image
                src="/images/logos/ans-logo.svg"
                alt="American Numismatic Society"
                width={96}
                height={96}
              />
              <span className="text-sm font-semibold text-gray-800">
                <T k="about.collab.ans" />
              </span>
            </a>
          </div>
        </DataCard>

        <DataCard title={<T k="about.resources.title" />}>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sources"
              className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
            >
              <T k="about.resources.sources" /> →
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-fit rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand-light"
            >
              <T k="about.resources.github" /> →
            </a>
          </div>
        </DataCard>
      </div>

      <AuthStatus />
    </div>
  )
}
