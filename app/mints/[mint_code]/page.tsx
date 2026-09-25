import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { MintIssueDistribution } from '@/components/mints/MintIssueDistribution'
import { MintImageGallery } from '@/components/mints/MintImageGallery'
import { MintCoinTypeHints, type MintCoinTypeHint } from '@/components/mints/MintCoinTypeHints'
import { MintPlaceholder } from '@/components/mints/MintPlaceholder'
import { MintRecordSection } from '@/components/mints/MintRecordSection'
import { CitationsSection } from '@/components/sources/CitationsSection'
import { DetailRow } from '@/components/ui/DetailRow'
import { Panel } from '@/components/ui/Panel'
import SinglePointMap from '@/components/map/SinglePointMap'
import { T } from '@/components/i18n/T'
import { isAuthorized } from '@/lib/admin/guard'
import { resolveSourceLinkTargets } from '@/lib/admin/resolve-source-link-target'
import { buildCoinTypeNodes, type CoinTypeLevel } from '@/lib/coin-type-catalog'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import { buildMintDirectory, getMintDirectoryEntryBySlug } from '@/lib/mint-directory'
import {
  getCoinIssues,
  getCoinTypeHierarchy,
  getImages,
  getMintFindspotsData,
  getMints,
  getSourceLinksForMint,
  getSources,
} from '@/lib/queries'

const LEVEL_RANK: Record<CoinTypeLevel, number> = { level1: 1, level2: 2, level3: 3, level4: 4, level5: 5 }

export const revalidate = 86400

type PageProps = {
  params: Promise<{ mint_code: string }>
}

/** Wrapped in React's cache() so generateMetadata and the page component
 * below — both called for the same request — share one directory build
 * instead of each fetching+flattening the mints table separately. */
const resolveMintPage = cache(async (mint_code: string) => {
  const [dbMints, images] = await Promise.all([getMints(), getImages()])
  const mint = getMintDirectoryEntryBySlug(buildMintDirectory(dbMints, images), mint_code)
  return { mint, dbMints }
})

export async function generateMetadata({ params }: PageProps) {
  const { mint_code } = await params
  const { mint } = await resolveMintPage(mint_code)
  if (!mint) return { title: 'Not found' }
  return {
    title: `${mint.name_zh} ${mint.name_en} | Mint Town Locations`,
    description: mint.description_zh ?? mint.description_en,
  }
}

export default async function MintDetailPage({ params }: PageProps) {
  const { mint_code } = await params
  const { mint, dbMints } = await resolveMintPage(mint_code)
  if (!mint) notFound()
  const rawMint = dbMints.find((m) => m.id === mint.id)
  const authorized = await isAuthorized()

  const [distribution, coinIssues, hierarchyRows] = await Promise.all([
    getMintFindspotsData(mint.id).catch(() => ({
      sites: [],
      typeOptions: [],
      siteTypeKeys: {},
      inscriptions: [],
      typeLabels: [],
      totalCoinCount: 0,
      siteCount: 0,
    })),
    getCoinIssues(),
    getCoinTypeHierarchy(),
  ])

  // Match each type label shown for this mint to its catalog node (deepest
  // level first) so the label can link/preview through to /coin-types —
  // labels are unique within a given mint's catalogue in practice.
  const catalogNodes = buildCoinTypeNodes(hierarchyRows, coinIssues)
  const coinTypeHints: MintCoinTypeHint[] = distribution.typeLabels.map(({ zh, en }) => {
    const candidates = catalogNodes
      .filter((n) => n.label_zh === zh && n.mints.some((m) => m.mint_zh === mint.name_zh))
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])
    const node = candidates[0]
    const images = node ? getCoinTypeImagePaths(node.imgAccNum, node.slug) : null
    return {
      zh,
      en,
      slug: node?.slug ?? null,
      obverseSrc: images?.obverseSrc ?? null,
      reverseSrc: images?.reverseSrc ?? null,
    }
  })

  const descriptionZh = mint.description_zh
  const descriptionEn = mint.description_en || null

  const mintSourceLinks = await getSourceLinksForMint(mint_code)
  const [mintSources, mintResolvedTargets] = await Promise.all([
    getSources(mintSourceLinks.map((l) => l.source_code)),
    resolveSourceLinkTargets(mintSourceLinks),
  ])
  const mintSourcesByCode = new Map(mintSources.map((s) => [s.source_code, s]))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <Link href="/mints" className="text-sm text-brand hover:underline">
          <T k="mintDetail.back" />
        </Link>
      </div>

      <h1 className="mb-6 font-serif text-3xl font-semibold text-brand">
        {mint.name_zh} <span className="text-xl font-normal italic text-gray-400">({mint.name_en})</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Location card */}
        <Panel header={<T k="mintDetail.location" />} bodyClassName="p-4">
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
                  : <T k="mintDetail.notYetEstablished" />
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
                <T k="mintDetail.noGeolocation" />
              </div>
            )}
          </div>
        </Panel>

        {/* Right: Information card */}
        <Panel header={<T k="mintDetail.information" />} bodyClassName="p-4">
          <dl>
            <DetailRow
              labelKey="mintDetail.row.name"
              value={
                <>
                  {mint.name_zh}
                  <span className="ml-2 text-sm italic text-gray-400">{mint.name_en}</span>
                </>
              }
            />
            <DetailRow
              labelKey="mintDetail.row.coinsAndSites"
              value={
                distribution.totalCoinCount > 0 ? (
                  <Link
                    href={`/search?mint=${encodeURIComponent(mint.name_zh)}`}
                    className="text-brand hover:underline"
                  >
                    <T
                      k="stats.coinsAcrossSites"
                      vars={{ coins: distribution.totalCoinCount, sites: distribution.siteCount }}
                    />
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <DetailRow
              labelKey="mintDetail.row.coinTypes"
              value={<MintCoinTypeHints items={coinTypeHints} />}
            />
            <DetailRow
              labelKey="mintDetail.row.inscriptions"
              value={
                distribution.inscriptions.length > 0 ? (
                  <>
                    {distribution.inscriptions.map((i, idx) => (
                      <span key={i.zh}>
                        {idx > 0 && '、'}
                        {i.zh}
                        {i.en && <span className="ml-1 text-xs italic text-gray-400">({i.en})</span>}
                      </span>
                    ))}
                  </>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </Panel>
      </div>

      {/* Description — straight from the mints table. */}
      <Panel header={<T k="mintDetail.description" />} className="mt-6" bodyClassName="space-y-3">
        {descriptionZh && <p className="whitespace-pre-line leading-7 text-gray-800">{descriptionZh}</p>}
        {descriptionEn ? (
          <p className="leading-7 italic text-gray-600">{descriptionEn}</p>
        ) : (
          <p className="text-sm italic text-gray-400">
            <T k="mintDetail.noEnglishDescription" />
          </p>
        )}
        {!descriptionZh && !descriptionEn && (
          <p className="text-sm italic text-gray-400">
            <T k="mintDetail.noDescription" />
          </p>
        )}
        {mint.location_note && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
            ⚠ {mint.location_note}
          </p>
        )}
      </Panel>

      {/* Database record — the raw `mints` table row, dev-only. */}
      {rawMint && authorized && (
        <Panel header="Database Record (dev only)" className="mt-6" bodyClassName="p-4">
          <MintRecordSection mint={rawMint} isDevMode />
        </Panel>
      )}

      {/* Mint + issued-coin findspot distribution */}
      <Panel header={<T k="mintDetail.issueDistribution.title" />} className="mt-6">
        {distribution.sites.length === 0 ? (
          <p className="text-sm text-gray-500">
            <T k="mintDetail.issueDistribution.noFindspots" />
          </p>
        ) : (
          <MintIssueDistribution
            mint={
              mint.lat != null && mint.lng != null
                ? {
                    name_zh: mint.name_zh,
                    name_en: mint.name_en,
                    lat: mint.lat,
                    lng: mint.lng,
                  }
                : null
            }
            sites={distribution.sites}
            siteTypeKeys={distribution.siteTypeKeys}
            typeOptions={distribution.typeOptions}
          />
        )}
      </Panel>

      {/* Maps & Images — site plans. Bronze photos and rubbings are separate. */}
      {mint.images.some((img) => img.kind !== 'inscription') && (
        <Panel header={<T k="mintDetail.mapsImages" />} className="mt-6">
          <MintImageGallery images={mint.images.filter((img) => img.kind !== 'inscription')} />
        </Panel>
      )}

      {mint.images.some((img) => img.kind === 'inscription') && (
        <Panel header={<T k="mintDetail.inscriptionMaterials" />} className="mt-6">
          <MintImageGallery images={mint.images.filter((img) => img.kind === 'inscription')} />
        </Panel>
      )}

      {/* Placeholder checklist for incomplete records */}
      <MintPlaceholder mint={mint} />

      {/* Sources & Citations — structured source_links on top, mint's own
          legacy freetext (sources_unlinked + citation) at the bottom. */}
      <Panel header={<T k="mintDetail.references" />} className="mt-6">
        <CitationsSection
          targetType="mint"
          targetCode={mint_code}
          targetLabel={`${mint.name_zh} (${mint.name_en})`}
          initialLinks={mintSourceLinks}
          sourcesByCode={mintSourcesByCode}
          resolvedTargets={mintResolvedTargets}
          isDevMode={authorized}
          legacy={
            mint.sources_unlinked.length === 0 && !mint.citation ? (
              <p className="text-sm text-gray-500">
                <T k="mintDetail.noReferences" />
              </p>
            ) : (
              <div className="space-y-2">
                {mint.sources_unlinked.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                    {mint.sources_unlinked.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                {mint.citation && (
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">
                      <T k="mintDetail.citationLabel" />
                    </span>{' '}
                    {mint.citation}
                  </p>
                )}
              </div>
            )
          }
        />
      </Panel>
    </div>
  )
}
