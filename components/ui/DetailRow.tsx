import type { ReactNode } from 'react'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'

/** One label/value row in a detail-page `<dl>` — shared between the mint
 * town and coin type detail pages so their "Information" cards read as one
 * system. */
export function DetailRow({ labelKey, value }: { labelKey: DictionaryKey; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">
        <T k={labelKey} />
      </dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}
