'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createMint } from '@/lib/admin/mints-actions'
import type { ActionState } from '@/lib/admin/types'
import type { Mint } from '@/lib/types'
import { EditableSection } from '@/components/edit/EditableSection'
import { MintFormFields } from './MintRecordSection'

const BLANK_MINT: Mint = {
  id: '',
  name_zh: '',
  name_en: null,
  precision_level: null,
  latitude: null,
  longitude: null,
  description_zh: null,
  description_en: null,
  citation: null,
  state_id: null,
  modern_location_zh: null,
  modern_location_en: null,
  location_note: null,
  image_ids: [],
  sources_unlinked: [],
  mint_code: '',
  alternative_names: [],
}

/** Dev-only "+ Add mint" affordance on the /mints list page. Creates a mint
 * inline; on success, refreshes the page so the (now server-fetched) list
 * picks it up — see lib/admin/mints-actions.ts createMint. */
export function AddMintSection({ isDevMode }: { isDevMode: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState<Mint | null>(null)

  if (!isDevMode) return null

  if (created) {
    return (
      <p className="text-sm font-medium text-emerald-700">
        Created “{created.name_zh}”.{' '}
        <button
          type="button"
          className="underline"
          onClick={() => {
            setCreated(null)
            setAdding(false)
          }}
        >
          Add another
        </button>
      </p>
    )
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="rounded border border-brand/30 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-light"
      >
        + Add mint
      </button>
    )
  }

  async function handleCreate(prev: ActionState<Mint>, formData: FormData): Promise<ActionState<Mint>> {
    const result = await createMint(prev, formData)
    if (result.ok) {
      setCreated(result.data)
      router.refresh()
    }
    return result
  }

  return (
    <div className="max-w-xl">
      <EditableSection
        data={BLANK_MINT}
        isDevMode
        startInEditing
        action={handleCreate}
        onCancelCreate={() => setAdding(false)}
        renderDisplay={() => null}
        renderForm={(m) => <MintFormFields mint={m} includeId={false} />}
      />
    </div>
  )
}
