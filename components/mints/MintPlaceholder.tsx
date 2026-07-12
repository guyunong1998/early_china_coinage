import type { MintTown } from '@/lib/mint-towns'

type Section = {
  key: string
  label: string
  done: boolean
}

function getSections(mint: MintTown): Section[] {
  return [
    {
      key: 'description',
      label: 'Site description',
      done: mint.description_en.length > 60,
    },
    {
      key: 'images',
      label: 'Maps & site images',
      done: (mint.images?.length ?? 0) > 0,
    },
    {
      key: 'references',
      label: 'Bibliographic references',
      done: mint.references.length > 0,
    },
    {
      key: 'coin_types',
      label: 'Coin types produced',
      done: mint.coin_types.length > 0,
    },
  ]
}

export function MintPlaceholder({ mint }: { mint: MintTown }) {
  const sections = getSections(mint)
  const allDone = sections.every((s) => s.done)

  if (allDone) return null

  const pending = sections.filter((s) => !s.done)
  const done = sections.filter((s) => s.done)

  return (
    <section className="mt-6 overflow-hidden border border-dashed border-brand/40 bg-white">
      <div className="flex items-center gap-3 border-b border-dashed border-brand/30 bg-brand-light px-4 py-3">
        <span className="text-brand" aria-hidden>
          ◷
        </span>
        <div>
          <p className="text-sm font-semibold text-brand">Record in preparation</p>
          <p className="text-xs text-gray-500">
            This entry is a placeholder. Content will be added progressively.
          </p>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Pending */}
        <div className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            To be added
          </p>
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 text-xs text-gray-300">
                  ○
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Completed */}
        <div className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Completed
          </p>
          <ul className="space-y-2">
            {done.length === 0 ? (
              <li className="text-xs text-gray-400 italic">None yet</li>
            ) : (
              done.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-xs text-brand">
                    ✓
                  </span>
                  {s.label}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-dashed border-brand/30 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500">
          <strong className="text-gray-700">How to add content:</strong> Edit{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            lib/mint-towns.ts
          </code>{' '}
          and find the entry for{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            {mint.mint_code}
          </code>
          . Place image files in{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
            public/images/mints/
          </code>
          .
        </p>
      </div>
    </section>
  )
}
