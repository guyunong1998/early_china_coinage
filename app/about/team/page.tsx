import Link from 'next/link'
import { T } from '@/components/i18n/T'

export const metadata = {
  title: 'About the People | Early Chinese Coin Finds',
  description: 'The researchers and collaborators behind the Early Chinese Coin Finds Database.',
}

export default function AboutTeamPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/about" className="text-sm font-semibold text-brand hover:underline">
        ← <T k="about.title" />
      </Link>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-brand">
        <T k="about.team.pageTitle" />
      </h1>
      <p className="mt-4 text-gray-700 leading-7">
        <T k="about.team.body" />
      </p>
    </div>
  )
}
