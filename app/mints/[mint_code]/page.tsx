import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MintIssueDistribution } from '@/components/mints/MintIssueDistribution'
import { MintImageGallery } from '@/components/mints/MintImageGallery'
import { MintPlaceholder } from '@/components/mints/MintPlaceholder'
import SinglePointMap from '@/components/map/SinglePointMap'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { getMintDossierByCode } from '@/lib/mint-dossiers'
import { getMintByCode } from '@/lib/mint-towns'
import { getMintFindspotsData } from '@/lib/queries'

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

  const distribution = await getMintFindspotsData(mint.name_zh).catch(() => ({
    sites: [],
    typeOptions: [],
    siteTypeKeys: {},
  }))
  const dossier = getMintDossierByCode(mint_code)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <Link href="/mints" className="text-sm text-brand hover:underline">
          <T k="mintDetail.back" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Location card */}
        <section className="panel overflow-hidden">
          <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
            <T k="mintDetail.location" />
          </div>
          <div className="p-4">
            <dl>
              <Row labelKey="mintDetail.row.state" value={`${mint.state_zh} (${mint.state_en})`} />
              <Row labelKey="mintDetail.row.modernLocation" value={mint.modern_location_en} />
              <Row
                labelKey="mintDetail.row.coordinates"
                value={
                  mint.lat != null && mint.lng != null
                    ? `${mint.lat.toFixed(6)}, ${mint.lng.toFixed(6)}`
                    : 'Not established in source document'
                }
              />
            </dl>
            <div className="mt-4 overflow-hidden border border-brand/20">
              {mint.lat != null && mint.lng != null ? (
                <SinglePointMap
                  lat={mint.lat}
                  lng={mint.lng}
                  label={`${mint.name_zh} (${mint.name_en})`}
                  height="280px"
                  zoom={12}
                />
              ) : (
                <div className="flex h-[280px] items-center justify-center bg-gray-50 text-sm text-gray-400">
                  Geolocation not yet established for this mint town.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right: Information card */}
        <section className="panel overflow-hidden">
          <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
            <T k="mintDetail.information" />
          </div>
          <div className="p-4">
            <dl>
              <Row labelKey="mintDetail.row.chineseName" value={mint.name_zh} />
              <Row labelKey="mintDetail.row.romanisation" value={mint.name_en} />
              <Row labelKey="mintDetail.row.state" value={`${mint.state_en} (${mint.state_zh})`} />
              <Row
                labelKey="mintDetail.row.coinTypes"
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

      {/* Description — dossier takes priority; falls back to mint.description_en */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="mintDetail.description" />
        </div>
        <div className="space-y-3 p-5">
          {dossier?.description_zh && (
            <p className="leading-7 text-gray-800">{dossier.description_zh}</p>
          )}
          {dossier?.description_en ? (
            <p className="leading-7 italic text-gray-600">{dossier.description_en}</p>
          ) : mint.description_en ? (
            <p className="leading-7 text-gray-800">{mint.description_en}</p>
          ) : (
            <p className="text-sm italic text-gray-400">
              No English description available yet in the source document.
            </p>
          )}
          {!dossier?.description_zh && !dossier?.description_en && !mint.description_en && (
            <p className="text-sm italic text-gray-400">
              No description recorded yet for this mint town.
            </p>
          )}
          {dossier?.location_note && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
              ⚠ {dossier.location_note}
            </p>
          )}
          {dossier?.coin_types && dossier.coin_types.length > 0 && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Coin types (from document):</span>{' '}
              {dossier.coin_types.join(', ')}
            </p>
          )}
          {dossier?.source_doc && (
            <p className="text-xs text-gray-400">
              Source: <span className="font-mono">{dossier.source_doc}</span>
            </p>
          )}
        </div>
      </section>

      {/* Mint + issued-coin findspot distribution */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          Issued Coin Distribution
        </div>
        <div className="p-5">
          {distribution.sites.length === 0 ? (
            <p className="text-sm text-gray-500">
              No findspot records linked to this mint in the current database.
            </p>
          ) : mint.lat != null && mint.lng != null ? (
            <MintIssueDistribution
              mint={{
                name_zh: mint.name_zh,
                name_en: mint.name_en,
                lat: mint.lat,
                lng: mint.lng,
              }}
              sites={distribution.sites}
              siteTypeKeys={distribution.siteTypeKeys}
              typeOptions={distribution.typeOptions}
            />
          ) : (
            <p className="text-sm text-gray-500">
              {distribution.sites.length} findspot record(s) exist for coins issued by this mint, but the
              mint&apos;s own location is not yet established, so the distribution map cannot be centred.
            </p>
          )}
        </div>
      </section>

      {/* Maps & Images */}
      {mint.images && mint.images.length > 0 && (
        <section className="panel mt-6 overflow-hidden">
          <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
            <T k="mintDetail.mapsImages" />
          </div>
          <div className="p-5">
            <MintImageGallery images={mint.images} />
          </div>
        </section>
      )}

      {/* Placeholder checklist for incomplete records */}
      <MintPlaceholder mint={mint} />

      {/* References — combines mint.references + dossier.references */}
      {(() => {
        const mintRefs = mint.references
        const dossierRefs = dossier?.references ?? []
        const hasAny = mintRefs.length > 0 || dossierRefs.length > 0
        return (
          <section className="panel mt-6 overflow-hidden">
            <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
              <T k="mintDetail.references" />
            </div>
            <div className="p-5">
              {!hasAny ? (
                <p className="text-sm text-gray-500">
                  <T k="mintDetail.noReferences" />
                </p>
              ) : (
                <div className="space-y-4">
                  {mintRefs.map((ref, i) => (
                    <div key={i} className="text-sm">
                      <p className="leading-6 text-gray-800">{ref.citation_zh}</p>
                      {ref.citation_en && (
                        <p className="mt-1 leading-6 italic text-gray-500">{ref.citation_en}</p>
                      )}
                      {ref.url && (
                        <a href={ref.url} className="mt-1 inline-block text-brand hover:underline">
                          {ref.url}
                        </a>
                      )}
                    </div>
                  ))}
                  {dossierRefs.length > 0 && (
                    <div>
                      {mintRefs.length > 0 && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Additional references (from research document)
                        </p>
                      )}
                      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                        {dossierRefs.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )
      })()}

      {/* Editing note */}
      <p className="mt-4 text-xs text-gray-400">
        To update descriptions, references, or images, edit{' '}
        <code className="font-mono">lib/mint-dossiers.ts</code> (research content) and{' '}
        <code className="font-mono">lib/mint-towns.ts</code> (core data). Place images under{' '}
        <code className="font-mono">public/images/mints/</code>.
      </p>
    </div>
  )
}

function Row({ labelKey, value }: { labelKey: DictionaryKey; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">
        <T k={labelKey} />
      </dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}
