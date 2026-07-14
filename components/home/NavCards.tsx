import Link from 'next/link'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

const cards: { href: string; labelKey: DictionaryKey; descKey: DictionaryKey; icon: string }[] = [
  {
    href: '/mints',
    labelKey: 'navcards.mints.label',
    descKey: 'navcards.mints.desc',
    icon: '◎',
  },
  {
    href: '/heatmap',
    labelKey: 'navcards.heatmap.label',
    descKey: 'navcards.heatmap.desc',
    icon: '⊕',
  },
  {
    href: '/about',
    labelKey: 'navcards.about.label',
    descKey: 'navcards.about.desc',
    icon: '◈',
  },
]

export function NavCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="panel group flex flex-col px-5 py-4"
        >
          <span className="text-xl text-brand/50">{card.icon}</span>
          <h2 className="mt-2 font-serif text-sm font-semibold text-gray-900 group-hover:text-brand">
            <T k={card.labelKey} />
          </h2>
          <p className="mt-1 text-xs leading-4 text-gray-500">
            <T k={card.descKey} />
          </p>
          <span className="mt-3 text-xs text-brand opacity-0 transition group-hover:opacity-100">
            →
          </span>
        </Link>
      ))}
    </div>
  )
}
