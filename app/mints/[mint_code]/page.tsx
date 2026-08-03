import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MintIssueDistribution } from '@/components/mints/MintIssueDistribution'
import { MintImageGallery } from '@/components/mints/MintImageGallery'
import { MintPlaceholder } from '@/components/mints/MintPlaceholder'
import { MintRecordSection } from '@/components/mints/MintRecordSection'
import { DetailRow } from '@/components/ui/DetailRow'
import SinglePointMap from '@/components/map/SinglePointMap'
import { T } from '@/components/i18n/T'
import { isAuthorized } from '@/lib/admin/guard'
import { buildMintDirectory, getMintDirectoryEntryBySlug } from '@/lib/mint-directory'
import { getImages, getMintFindspotsData, getMints } from '@/lib/queries'

type PageProps = {
  params: Promise<{ mint_code: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { mint_code } = await params
  const mint = getMintDirectoryEntryBySlug(buildMintDirectory(await getMints()), mint_code)
  if (!mint) return { title: 'Not found' }
  return {
    title: `${mint.name_zh} ${mint.name_en} | Mint Town Locations`,
    description: mint.description_zh ?? mint.description_en,
  }
}

export default async function MintDetailPage({ params }: PageProps) {
  const { mint_code } = await params
  const [dbMints, images] = await Promise.all([getMints(), getImages()])
  const mint = getMintDirectoryEntryBySlug(buildMintDirectory(dbMints, images), mint_code)
  if (!mint) notFound()
  const rawMint = dbMints.find((m) => m.id === mint.id)
  const authorized = await isAuthorized()

  const distribution = await getMintFindspotsData(mint.id).catch(() => ({
    sites: [],
    typeOptions: [],
    siteTypeKeys: {},
    inscriptions: [],
    typeLabels: [],
    totalCoinCount: 0,
    siteCount: 0,
  }))

  const descriptionZh = mint.description_zh
  const descriptionEn = mint.description_en || null

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
              <DetailRow labelKey="mintDetail.row.state" value={`${mint.state_zh} (${mint.state_en})`} />
              <DetailRow
                labelKey="mintDetail.row.modernLocation"
                value={
                  mint.modern_location_zh
                    ? `${mint.modern_location_zh} (${mint.modern_location_en})`
                    : mint.modern_location_en
                }
              />
              <DetailRow
                labelKey="mintDetail.row.coordinates"
                value={
                  mint.lat != null && mint.lng != null
                    ? `${mint.lat.toFixed(6)}, ${mint.lng.toFixed(6)}`
                    : 'Not yet established'
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
              <DetailRow
                labelKey="mintDetail.row.name"
                value={
                  <>
                    {mint.name_zh}{' '}
                    <span className="text-xs italic text-gray-400">({mint.name_en})</span>
                  </>
                }
              />
              <DetailRow
                labelKey="mintDetail.row.coinsAndSites"
                value={
                  distribution.totalCoinCount > 0
                    ? `${distribution.totalCoinCount} coins across ${distribution.siteCount} sites`
                    : '—'
                }
              />
              <DetailRow
                labelKey="mintDetail.row.coinTypes"
                value={
                  distribution.typeLabels.length > 0
                    ? distribution.typeLabels.map((t) => (t.en ? `${t.zh} (${t.en})` : t.zh)).join('、')
                    : '—'
                }
              />
              <DetailRow
                labelKey="mintDetail.row.inscriptions"
                value={
                  distribution.inscriptions.length > 0
                    ? distribution.inscriptions.map((i) => (i.en ? `${i.zh} (${i.en})` : i.zh)).join('、')
                    : '—'
                }
              />
            </dl>
          </div>
        </section>
      </div>

      {/* Description — straight from the mints table. */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="mintDetail.description" />
        </div>
        <div className="space-y-3 p-5">
          {descriptionZh && <p className="leading-7 text-gray-800">{descriptionZh}</p>}
          {descriptionEn ? (
            <p className="leading-7 italic text-gray-600">{descriptionEn}</p>
          ) : (
            <p className="text-sm italic text-gray-400">No English description recorded yet.</p>
          )}
          {!descriptionZh && !descriptionEn && (
            <p className="text-sm italic text-gray-400">
              No description recorded yet for this mint town.
            </p>
          )}
          {mint.location_note && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
              ⚠ {mint.location_note}
            </p>
          )}
          {mint.citation && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Citation:</span> {mint.citation}
            </p>
          )}
        </div>
      </section>

      {/* Database record — the raw `mints` table row, dev-only. */}
      {rawMint && authorized && (
        <section className="panel mt-6 overflow-hidden">
          <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
            Database Record (dev only)
          </div>
          <div className="p-4">
            <MintRecordSection mint={rawMint} isDevMode />
          </div>
        </section>
      )}

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
      {mint.images.length > 0 && (
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

      {/* References — mint.sources_unlinked, raw citation strings not yet
          matched to a public.sources row (see mints.sources_unlinked). */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="mintDetail.references" />
        </div>
        <div className="p-5">
          {mint.sources_unlinked.length === 0 ? (
            <p className="text-sm text-gray-500">
              <T k="mintDetail.noReferences" />
            </p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {mint.sources_unlinked.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Editing note */}
      <p className="mt-4 text-xs text-gray-400">
        Everything on this page — description, geolocation, citation, state, modern location,
        location note, images, and references — comes from the{' '}
        <code className="font-mono">mints</code> / <code className="font-mono">images</code> tables
        in Supabase.
      </p>
    </div>
  )
}
