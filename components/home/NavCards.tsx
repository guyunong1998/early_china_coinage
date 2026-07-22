import Link from 'next/link'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

type Card = {
  href: string
  icon: string
  labelKey: DictionaryKey
  descKey: DictionaryKey
}

const cards: Card[] = [
  { href: '/mints', icon: '◎', labelKey: 'navcards.mints.label', descKey: 'navcards.mints.desc' },
  { href: '/coin-types', icon: '◇', labelKey: 'navcards.coinTypes.label', descKey: 'navcards.coinTypes.desc' },
  { href: '/museum-collections', icon: '◉', labelKey: 'navcards.spadeHeatmap.label', descKey: 'navcards.spadeHeatmap.desc' },
  { href: '/about', icon: '◈', labelKey: 'navcards.about.label', descKey: 'navcards.about.desc' },
]

export function NavCards() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="panel-nav-card group flex flex-col p-3">
          <div className="panel-nav-card-inner flex flex-1 flex-col px-4 py-3">
            <span className="text-xl text-brand/50">{card.icon}</span>
            <h2 className="mt-2 font-serif text-sm font-semibold text-gray-900">
              <T k={card.labelKey} />
            </h2>
            <p className="mt-1 text-xs leading-4 text-gray-500">
              <T k={card.descKey} />
            </p>
            <span className="mt-3 text-xs text-brand opacity-0 transition group-hover:opacity-100">→</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
