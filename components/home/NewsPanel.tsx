const newsItems = [
  {
    title: 'Database launch: 184 validated find sites indexed',
    href: '/about',
  },
  {
    title: 'Interactive map now available for all georeferenced sites',
    href: '/map',
  },
  {
    title: 'Mint town records with descriptions and references now online',
    href: '/mints',
  },
]

export function NewsPanel() {
  return (
    <aside className="flex flex-col border border-brand/20 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-brand px-4 py-2.5 text-white">
        <h2 className="font-semibold tracking-wide">News</h2>
        <span aria-hidden className="text-sm">→</span>
      </div>
      <ul className="flex flex-1 flex-col divide-y divide-gray-100">
        {newsItems.map((item) => (
          <li key={item.title} className="flex-1">
            <a
              href={item.href}
              className="flex h-full flex-col justify-center px-4 py-3 text-sm hover:bg-brand-light/40"
            >
              <span className="font-medium leading-5 text-gray-800">{item.title}</span>
              <span className="mt-1 text-xs text-brand">more…</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
