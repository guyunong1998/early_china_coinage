import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MintImageGallery } from '@/components/mints/MintImageGallery'
import { MintPlaceholder } from '@/components/mints/MintPlaceholder'
import SinglePointMap from '@/components/map/SinglePointMap'
import { getMintByCode } from '@/lib/mint-towns'

type PageProps = {
  params: Promise<{ mint_code: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { mint_code } = await params
  const mint = getMintByCode(mint_code)
  if (!mint) return { title: 'Not found' }
  return {
    title: `${mint.name_zh} ${mint.name_en} | Mint Town Locations`,
    description: mint.description_en,
  }
}

export default async function MintDetailPage({ params }: PageProps) {
  const { mint_code } = await params
  const mint = getMintByCode(mint_code)
  if (!mint) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <Link href="/mints" className="text-sm text-brand hover:underline">
          ← Mint Town Locations
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Location card */}
        <section className="overflow-hidden border border-brand bg-white">
          <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Location
          </div>
          <div className="p-4">
            <dl>
              <Row label="State" value={`${mint.state_zh} (${mint.state_en})`} />
              <Row label="Modern location" value={mint.modern_location_en} />
              <Row
                label="Coordinates"
                value={`${mint.lat.toFixed(6)}, ${mint.lng.toFixed(6)}`}
              />
            </dl>
            <div className="mt-4 overflow-hidden border border-brand/20">
              <SinglePointMap
                lat={mint.lat}
                lng={mint.lng}
                label={`${mint.name_zh} (${mint.name_en})`}
                height="280px"
                zoom={12}
              />
            </div>
          </div>
        </section>

        {/* Right: Information card */}
        <section className="overflow-hidden border border-brand bg-white">
          <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Information
          </div>
          <div className="p-4">
            <dl>
              <Row label="Chinese name" value={mint.name_zh} />
              <Row label="Romanisation" value={mint.name_en} />
              <Row label="State" value={`${mint.state_en} (${mint.state_zh})`} />
              <Row
                label="Coin types"
                value={
                  mint.coin_types.length > 0
                    ? mint.coin_types.join(', ')
                    : '—'
                }
              />
            </dl>
          </div>
        </section>
      </div>

      {/* Description */}
      <section className="mt-6 overflow-hidden border border-brand bg-white">
        <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
          Description
        </div>
        <div className="p-5">
          <p className="leading-7 text-gray-800">{mint.description_en}</p>
        </div>
      </section>

      {/* Maps & Images */}
      {mint.images && mint.images.length > 0 && (
        <section className="mt-6 overflow-hidden border border-brand bg-white">
          <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Maps &amp; Images
          </div>
          <div className="p-5">
            <MintImageGallery images={mint.images} />
          </div>
        </section>
      )}

      {/* Placeholder checklist for incomplete records */}
      <MintPlaceholder mint={mint} />

      {/* References */}
      <section className="mt-6 overflow-hidden border border-brand bg-white">
        <div className="bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
          References
        </div>
        <div className="p-5">
          {mint.references.length === 0 ? (
            <p className="text-sm text-gray-500">No references recorded yet.</p>
          ) : (
            <ol className="space-y-4">
              {mint.references.map((ref, i) => (
                <li key={i} className="text-sm">
                  <p className="leading-6 text-gray-800">{ref.citation_zh}</p>
                  {ref.citation_en && (
                    <p className="mt-1 leading-6 text-gray-500 italic">{ref.citation_en}</p>
                  )}
                  {ref.url && (
                    <a
                      href={ref.url}
                      className="mt-1 inline-block text-brand hover:underline"
                    >
                      {ref.url}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}
