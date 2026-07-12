import { ReactNode } from 'react'

type DataRowProps = {
  label: string
  value: ReactNode
}

export function DataRow({ label, value }: DataRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}
