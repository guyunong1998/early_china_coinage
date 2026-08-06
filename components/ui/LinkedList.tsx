import Link from 'next/link'

/** A '、'-joined list of labels (coin types, mints, ...), each one linked to
 * its own detail page when `resolve` finds a match — plain, unstyled text
 * until hovered, at which point it reads as a link (brand color + underline),
 * same as any other in-text link. Labels that don't resolve to a record just
 * render as plain text, never picking up hover styling. Shared between the
 * site and coin-type detail pages so mint (and coin-type) references read
 * the same way everywhere. */
export function linkedList(
  items: string[],
  resolve: (labelZh: string) => { en: string | null; href: string | null }
) {
  if (items.length === 0) return <span className="text-gray-400">—</span>
  return (
    <>
      {items.map((label, i) => {
        const { en, href } = resolve(label)
        return (
          <span key={label}>
            {i > 0 && '、'}
            {href ? (
              <Link href={href} className="text-gray-800 hover:text-brand hover:underline">
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
            {en && <span className="ml-1 text-xs italic text-gray-400">({en})</span>}
          </span>
        )
      })}
    </>
  )
}
