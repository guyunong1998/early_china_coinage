import { ReactNode } from 'react'
import { Panel } from '@/components/ui/Panel'

type DataCardProps = {
  title: ReactNode
  children: ReactNode
  className?: string
  id?: string
}

export function DataCard({ title, children, className = '', id }: DataCardProps) {
  return (
    <Panel id={id} header={title} className={className}>
      {children}
    </Panel>
  )
}
