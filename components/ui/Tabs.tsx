'use client'

import { ReactNode, useState } from 'react'

type Tab = {
  id: string
  label: ReactNode
  content: ReactNode
}

type TabsProps = {
  tabs: Tab[]
  /** Extra content (e.g. a filter control) shown alongside the tab buttons,
   * pushed to the far end of the header row. */
  headerExtra?: ReactNode
}

export function Tabs({ tabs, headerExtra }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id)

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveId(tab.id)}
                className={`border border-brand px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'bg-white text-brand hover:bg-brand-light'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        {headerExtra}
      </div>
      <div className="border border-brand bg-white p-4">{activeTab?.content}</div>
    </div>
  )
}
