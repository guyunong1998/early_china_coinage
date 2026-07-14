import { ReactNode } from 'react'

type DataCardProps = {
  title: ReactNode
  children: ReactNode
  className?: string
  id?: string
}

export function DataCard({ title, children, className = '', id }: DataCardProps) {
  return (
    <section id={id} className={`overflow-hidden border border-brand bg-white ${className}`}>
      <div className="inline-block bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
