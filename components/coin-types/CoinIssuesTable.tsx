'use client'

import { useState } from 'react'
import type { CoinIssueDisplay } from '@/lib/types'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'
import { T } from '@/components/i18n/T'
import { CoinIssueRow } from './CoinIssueRow'

export function CoinIssuesTable({
  issues,
  isDevMode,
  mintOptions,
  stateOptions,
  inscriptionOptions,
  hierarchyOptions,
}: {
  issues: CoinIssueDisplay[]
  isDevMode: boolean
  mintOptions: ComboOption[]
  stateOptions: ComboOption[]
  inscriptionOptions: ComboOption[]
  hierarchyOptions: ComboOption[]
}) {
  const [rows, setRows] = useState(issues)

  function replace(updated: CoinIssueDisplay) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
          <th className="py-2 pr-4"><T k="ui.code" /></th>
          <th className="py-2 pr-4"><T k="siteTabs.table.type" /></th>
          <th className="py-2 pr-4"><T k="siteTabs.table.inscription" /></th>
          <th className="py-2 pr-4"><T k="siteTabs.table.state" /></th>
          <th className="py-2 pr-4"><T k="siteTabs.table.mint" /></th>
          <th className="py-2"><T k="site.descriptionLabel" /></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((issue) => (
          <CoinIssueRow
            key={issue.id}
            issue={issue}
            isDevMode={isDevMode}
            mintOptions={mintOptions}
            stateOptions={stateOptions}
            inscriptionOptions={inscriptionOptions}
            hierarchyOptions={hierarchyOptions}
            onSaved={replace}
          />
        ))}
      </tbody>
    </table>
  )
}
