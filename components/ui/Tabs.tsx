'use client'

import { ReactNode, useState } from 'react'

type Tab = {
  id: string
  label: string
  content: ReactNode
}

type TabsProps = {
  tabs: Tab[]
}

export function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id)

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <div>
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
      <div className="border border-brand border-t-0 bg-white p-4">{activeTab?.content}</div>
    </div>
  )
}
