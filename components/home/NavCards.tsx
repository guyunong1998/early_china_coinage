import Link from 'next/link'

const cards = [
  {
    href: '/mints',
    label: 'Mint Town Location',
    description: 'Geographic distribution of coin-producing centres',
    icon: '◎',
  },
  {
    href: '/map',
    label: 'Find Spots',
    description: 'Interactive map of all georeferenced coin find sites',
    icon: '⊕',
  },
  {
    href: '/heatmap',
    label: 'Heatmap',
    description: 'Pointed-foot spade production by mint town',
    icon: '◉',
  },
  {
    href: '/about',
    label: 'About',
    description: 'Project scope, team, and collaborations',
    icon: '◈',
  },
]

export function NavCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group flex flex-col border border-brand/25 bg-white px-5 py-4 shadow-sm transition hover:border-brand hover:shadow-md"
        >
          <span className="text-xl text-brand/50">{card.icon}</span>
          <h2 className="mt-2 font-serif text-sm font-semibold text-gray-900 group-hover:text-brand">
            {card.label}
          </h2>
          <p className="mt-1 text-xs leading-4 text-gray-500">{card.description}</p>
          <span className="mt-3 text-xs text-brand opacity-0 transition group-hover:opacity-100">
            →
          </span>
        </Link>
      ))}
    </div>
  )
}
