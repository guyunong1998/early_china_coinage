import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import type { MintDirectoryEntry } from '@/lib/mint-directory'

type Section = {
  key: string
  labelKey: DictionaryKey
  done: boolean
}

function getSections(mint: MintDirectoryEntry): Section[] {
  return [
    {
      key: 'geolocation',
      labelKey: 'mintDetail.placeholder.geolocation',
      done: mint.lat != null && mint.lng != null,
    },
    {
      key: 'description',
      labelKey: 'mintDetail.placeholder.description',
      done: mint.description_en.length > 60,
    },
    {
      key: 'images',
      labelKey: 'mintDetail.placeholder.images',
      done: mint.images.length > 0,
    },
    {
      key: 'sources',
      labelKey: 'sources.title',
      done: mint.sources_unlinked.length > 0,
    },
  ]
}

export function MintPlaceholder({ mint }: { mint: MintDirectoryEntry }) {
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
          <p className="text-sm font-semibold text-brand">
            <T k="mintDetail.placeholder.recordInPrep" />
          </p>
          <p className="text-xs text-gray-500">
            <T k="mintDetail.placeholder.note" />
          </p>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Pending */}
        <div className="p-4">
          <p className="mb-2 text-xs eyebrow text-gray-400">
            <T k="mintDetail.placeholder.toBeAdded" />
          </p>
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 text-xs text-gray-300">
                  ○
                </span>
                <T k={s.labelKey} />
              </li>
            ))}
          </ul>
        </div>

        {/* Completed */}
        <div className="p-4">
          <p className="mb-2 text-xs eyebrow text-gray-400">
            <T k="mintDetail.placeholder.completed" />
          </p>
          <ul className="space-y-2">
            {done.length === 0 ? (
              <li className="text-xs text-gray-400 italic">
                <T k="mintDetail.placeholder.noneYet" />
              </li>
            ) : (
              done.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-xs text-brand">
                    ✓
                  </span>
                  <T k={s.labelKey} />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
