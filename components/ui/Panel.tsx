import type { ReactNode } from 'react'

type PanelProps = {
  header: ReactNode
  children: ReactNode
  id?: string
  /** Extra classes on the outer bordered element (e.g. spacing like `mt-6`). */
  className?: string
  /** Extra classes on the `.panel-header` bar (e.g. `inline-block` for a
   * header that shouldn't span the card's full width). */
  headerClassName?: string
  /** Extra classes on the `.panel-body` content area — the default `p-5`
   * padding can be overridden here (e.g. `p-4`, `p-4 pl-8`). */
  bodyClassName?: string
}

/** The site's one shared "card with a dark green header" shape:
 * `.panel` > `.panel-header` + `.panel-body`. Use `CollapsiblePanel` instead
 * when the whole card should open/close via a native `<details>`. */
export function Panel({ header, children, id, className = '', headerClassName = '', bodyClassName = '' }: PanelProps) {
  return (
    <section id={id} className={`panel overflow-hidden ${className}`}>
      <div className={`panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide ${headerClassName}`}>
        {header}
      </div>
      <div className={`panel-body p-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

type CollapsiblePanelProps = PanelProps & { defaultOpen?: boolean }

/** Same shape as `Panel`, but the whole card is a native `<details>` —
 * `.panel-collapsible` (see globals.css) keeps its corners fully rounded
 * while closed and top-only once open, matching a plain `Panel`. */
export function CollapsiblePanel({
  header,
  children,
  id,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  defaultOpen = false,
}: CollapsiblePanelProps) {
  return (
    <details id={id} open={defaultOpen} className={`group panel panel-collapsible overflow-hidden ${className}`}>
      <summary
        className={`flex list-none cursor-pointer items-center justify-between panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide ${headerClassName}`}
      >
        {header}
        <span aria-hidden className="transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className={`panel-body p-5 ${bodyClassName}`}>{children}</div>
    </details>
  )
}
