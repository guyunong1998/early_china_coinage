import Link from 'next/link'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

type CardLink = { href: string; labelKey: DictionaryKey }

type Card = {
  icon: string
  labelKey: DictionaryKey
  descKey: DictionaryKey
  links: CardLink[]
}

const cards: Card[] = [
  {
    icon: '◎',
    labelKey: 'navcards.explore.label',
    descKey: 'navcards.explore.desc',
    links: [
      { href: '/mints', labelKey: 'nav.mints' },
      { href: '/coin-types', labelKey: 'nav.coinTypes' },
    ],
  },
  {
    icon: '◉',
    labelKey: 'navcards.spadeHeatmap.label',
    descKey: 'navcards.spadeHeatmap.desc',
    links: [{ href: '/museum-collections', labelKey: 'navcards.spadeHeatmap.label' }],
  },
  {
    icon: '◈',
    labelKey: 'navcards.about.label',
    descKey: 'navcards.about.desc',
    links: [{ href: '/about', labelKey: 'navcards.about.label' }],
  },
]

function CardBody({ card }: { card: Card }) {
  return (
    <>
      <span className="text-xl text-brand/50">{card.icon}</span>
      <h2 className="mt-2 font-serif text-sm font-semibold text-gray-900">
        <T k={card.labelKey} />
      </h2>
      <p className="mt-1 text-xs leading-4 text-gray-500">
        <T k={card.descKey} />
      </p>
    </>
  )
}

export function NavCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        // A single-destination card (e.g. Museum Collections) is one big
        // clickable tile — no separate link line, just an arrow that appears
        // on hover of the whole box. A card with several destinations (e.g.
        // Explore, About) instead lists each as its own line, arrow on hover
        // of that one link.
        if (card.links.length === 1) {
          return (
            <Link
              key={card.labelKey}
              href={card.links[0].href}
              className="panel-nav-card group flex flex-col p-3"
            >
              <div className="panel-nav-card-inner flex flex-1 flex-col px-4 py-3">
                <CardBody card={card} />
                <span className="mt-3 text-xs text-brand opacity-0 transition group-hover:opacity-100">
                  →
                </span>
              </div>
            </Link>
          )
        }

        return (
          <div key={card.labelKey} className="panel-nav-card flex flex-col p-3">
            <div className="panel-nav-card-inner flex flex-1 flex-col px-4 py-3">
              <CardBody card={card} />
              <div className="mt-3 flex flex-col gap-1.5">
                {card.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    <T k={link.labelKey} />
                    <span className="opacity-0 transition group-hover:opacity-100">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
