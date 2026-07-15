import { ReactNode } from 'react'

type DataCardProps = {
  title: ReactNode
  children: ReactNode
  className?: string
  id?: string
}

export function DataCard({ title, children, className = '', id }: DataCardProps) {
  return (
    <section id={id} className={className}>
      <div className="panel-header inline-block px-4 py-2 text-sm font-bold uppercase tracking-wide">
        {title}
      </div>
      <div className="panel-body overflow-hidden">
        <div className="p-4">{children}</div>
      </div>
    </section>
  )
}
