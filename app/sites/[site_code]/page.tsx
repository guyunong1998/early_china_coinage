import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CoinMapSection } from '@/components/map/CoinMapSection'
import { HoardMintOriginsMap, type HoardMintOrigin } from '@/components/map/HoardMintOriginsMap'
import { SiteDetailTabs } from '@/components/site/SiteDetailTabs'
import { CopyButton } from '@/components/ui/CopyButton'
import { DataCard } from '@/components/ui/DataCard'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { formatCoordinates, formatNumber } from '@/lib/format'
import { getMintByNameZh } from '@/lib/mint-towns'
import {
  getSite,
  getSiteContexts,
  getSiteFinds,
  getSiteMapSummary,
  getSources,
} from '@/lib/queries'
import type { Find } from '@/lib/types'

type PageProps = {
  params: Promise<{ site_code: string }>
}

function splitSourceCodes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[、,，;；|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const UNKNOWN_MINT_TOKENS = ['未知', '不详', '无', '—', '-', 'n/a', 'na', 'unknown', '']

function findQuantity(find: Find) {
  return find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? 0
}

function coinTypeLabel(find: Find) {
  return (
    find.coin_types?.inscription?.trim() ||
    find.coin_types?.minor_type_zh?.trim() ||
    find.coin_types?.major_type_zh?.trim() ||
    find.description_zh?.trim() ||
    null
  )
}

type MintOriginGroup = {
  mint_zh: string
  mint_en: string | null
  quantity: number
  findCount: number
  coinTypes: Set<string>
}

/** Group a site's finds by the mint that issued each coin, for the "Coin Mint Origins" map. */
function buildMintOrigins(finds: Find[]): {
  matched: HoardMintOrigin[]
  unmatched: MintOriginGroup[]
} {
  const groups = new Map<string, MintOriginGroup>()

  finds.forEach((find) => {
    const mintZh = find.coin_types?.mint_zh?.trim() ?? ''
    if (UNKNOWN_MINT_TOKENS.includes(mintZh.toLowerCase())) return

    if (!groups.has(mintZh)) {
      groups.set(mintZh, {
        mint_zh: mintZh,
        mint_en: find.coin_types?.mint_en ?? null,
        quantity: 0,
        findCount: 0,
        coinTypes: new Set(),
      })
    }
    const group = groups.get(mintZh)!
    group.quantity += findQuantity(find)
    group.findCount += 1
    const label = coinTypeLabel(find)
    if (label) group.coinTypes.add(label)
  })

  const matched: HoardMintOrigin[] = []
  const unmatched: MintOriginGroup[] = []

  groups.forEach((group) => {
    const mintTown = getMintByNameZh(group.mint_zh)
    if (mintTown && mintTown.lat != null && mintTown.lng != null) {
      matched.push({
        mint_code: mintTown.mint_code,
        mint_zh: group.mint_zh,
        mint_en: group.mint_en ?? mintTown.name_en,
        lat: mintTown.lat,
        lng: mintTown.lng,
        quantity: group.quantity,
        findCount: group.findCount,
        coinTypes: [...group.coinTypes],
      })
    } else {
      unmatched.push(group)
    }
  })

  return { matched, unmatched }
}

export async function generateMetadata({ params }: PageProps) {
  const { site_code } = await params
  const site = await getSite(site_code)
  if (!site) return { title: 'Site not found' }
  return {
    title: `${site.site_name_zh ?? site_code} | Early Chinese Coin Finds`,
    description: site.description_en ?? site.description_zh ?? undefined,
  }
}

// ── bilingual cell helpers ────────────────────────────────────────────────

/** Short field: zh · en on one line */
function bi(zh: string | null | undefined, en: string | null | undefined) {
  const a = zh?.trim()
  const b = en?.trim()
  if (!a && !b) return <span className="text-gray-400">—</span>
  if (!b || b === a) return <span>{a ?? '—'}</span>
  return (
    <span>
      {a ?? '—'}
      <span className="ml-2 text-sm italic text-gray-400">{b}</span>
    </span>
  )
}

/** Long field: zh paragraph + en paragraph below */
function biBlock(zh: string | null | undefined, en: string | null | undefined) {
  const a = zh?.trim()
  const b = en?.trim()
  if (!a && !b) return <span className="text-gray-400">—</span>
  return (
    <div className="space-y-1">
      {a && <p>{a}</p>}
      {b && b !== a && <p className="italic text-gray-500">{b}</p>}
    </div>
  )
}

// ── row component ─────────────────────────────────────────────────────────

function Row({ labelKey, children }: { labelKey: DictionaryKey; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">
        <T k={labelKey} />
      </dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────

export default async function SitePage({ params }: PageProps) {
  const { site_code } = await params
  const site = await getSite(site_code)
  if (!site) notFound()

  const summary = await getSiteMapSummary(site_code)
  const contexts = await getSiteContexts(site_code)
  const finds = await getSiteFinds(contexts.map((c) => c.context_code))

  // Support multiple refs stored in one field, e.g. "SRC001;SRC002"
  const sourceCodes = [
    ...splitSourceCodes(site.source_code),
    ...contexts.flatMap((c) => splitSourceCodes(c.source_code)),
    ...finds.flatMap((f) => splitSourceCodes(f.source_code)),
  ]

  const sources = await getSources(sourceCodes)

  const permalink =
    typeof process.env.NEXT_PUBLIC_SITE_URL === 'string'
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/sites/${site_code}`
      : `/sites/${site_code}`

  // Prefer strict sum from find quantities to avoid overcounting presence-only rows.
  const derivedTotalCoins = finds.reduce(
    (sum, find) => sum + (find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? 0),
    0
  )
  const hasExplicitQuantity = finds.some(
    (find) =>
      find.quantity_total != null || find.quantity_estimated != null || find.quantity_min != null
  )
  const totalCoins = hasExplicitQuantity
    ? derivedTotalCoins
    : (summary?.total_quantity_for_map ?? null)

  const mapSites =
    summary?.lat != null && summary.lng != null
      ? [{ ...summary, total_quantity_for_map: totalCoins }]
      : []
  const infoTextZh = site.note_zh?.trim() || site.description_zh
  const infoTextEn = site.note_en?.trim() || site.description_en

  const mintOrigins =
    summary?.lat != null && summary.lng != null ? buildMintOrigins(finds) : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <Link href="/" className="text-sm text-brand hover:underline">
          <T k="site.back" />
        </Link>
      </div>

      {/* ── site title ── */}
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">
          {site.site_name_zh ?? site_code}
          {site.site_name_en && (
            <span className="ml-3 text-lg font-normal italic text-gray-500">
              {site.site_name_en}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {[site.province_zh, site.city_zh, site.county_zh].filter(Boolean).join(' · ')}
          {site.province_en && (
            <span className="ml-2 italic text-gray-400">
              {[site.province_en, site.city_en, site.county_en].filter(Boolean).join(', ')}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Location ── */}
        <DataCard title={<T k="site.location.title" />}>
          <dl>
            <Row labelKey="site.row.province">{bi(site.province_zh, site.province_en)}</Row>
            <Row labelKey="site.row.city">{bi(site.city_zh, site.city_en)}</Row>
            <Row labelKey="site.row.county">{bi(site.county_zh, site.county_en)}</Row>
            <Row labelKey="site.row.latLong">{formatCoordinates(site.lat, site.lng)}</Row>
            <Row labelKey="site.row.locationDetails">
              {biBlock(site.location_detail_zh, site.location_detail_en)}
            </Row>
          </dl>
          {mapSites.length > 0 && (
            <div className="mt-4 overflow-hidden border border-brand/20">
              <CoinMapSection
                sites={mapSites}
                height="280px"
                fitBounds={false}
                highlightSiteCode={site_code}
              />
            </div>
          )}
        </DataCard>

        {/* ── Information ── */}
        <DataCard title={<T k="site.information.title" />}>
          <dl>
            <Row labelKey="site.row.id">
              <span className="font-mono text-xs">{site.site_code}</span>
            </Row>
            <Row labelKey="site.row.permalink">
              <span className="break-all text-xs">
                {permalink}
                <CopyButton value={permalink} />
              </span>
            </Row>
            <Row labelKey="site.row.siteType">{bi(site.site_type_zh ?? summary?.site_type_zh, site.site_type_en ?? summary?.site_type_en)}</Row>
            <Row labelKey="site.row.period">{bi(site.period_zh, site.period_en)}</Row>
            <Row labelKey="site.row.findRecords">{formatNumber(summary?.find_record_count ?? finds.length)}</Row>
            <Row labelKey="site.row.totalCoins">{formatNumber(totalCoins)}</Row>
          </dl>

          {/* Keep description area visible: prefer remark, fallback to description */}
          <div className="mt-4 border-t border-gray-100 pt-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Description / 描述
            </p>
            {biBlock(infoTextZh, infoTextEn)}
          </div>
        </DataCard>
      </div>

      <div className="mt-6">
        <DataCard title="Record Classification">
          <div className="grid gap-6 lg:grid-cols-2">
            <dl>
              <Row labelKey="siteTabs.row.majorTypes">{bi(summary?.major_types_zh, null)}</Row>
              <Row labelKey="siteTabs.row.minorTypes">{bi(summary?.minor_types_zh, null)}</Row>
              <Row labelKey="siteTabs.row.inscriptions">{bi(summary?.inscriptions, null)}</Row>
            </dl>
            <dl>
              <Row labelKey="siteTabs.row.states">{bi(summary?.states_zh, null)}</Row>
              <Row labelKey="siteTabs.row.mints">{bi(summary?.mints_zh, null)}</Row>
              <Row labelKey="siteTabs.row.precision">
                {formatNumber(site.precision_level ?? summary?.precision_level)}
              </Row>
            </dl>
          </div>
        </DataCard>
      </div>

      {mintOrigins && mintOrigins.matched.length > 0 && (
        <div className="mt-6">
          <DataCard title="Coin Mint Origins">
            <div className="space-y-2">
              <HoardMintOriginsMap
                site={{
                  site_code,
                  name_zh: site.site_name_zh,
                  name_en: site.site_name_en,
                  lat: summary!.lat as number,
                  lng: summary!.lng as number,
                }}
                mints={mintOrigins.matched}
              />
              <p className="text-xs text-gray-500">
                Teal marker: this findspot. Red markers: mint towns that issued coins found here, connected
                by dashed lines.
              </p>
            </div>
            {mintOrigins.unmatched.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                Mint location not yet mapped for:{' '}
                {mintOrigins.unmatched.map((m) => m.mint_zh).join('、')}
              </p>
            )}
          </DataCard>
        </div>
      )}

      <div className="mt-8">
        <SiteDetailTabs
          contexts={contexts}
          finds={finds}
          sources={sources}
        />
      </div>
    </div>
  )
}
