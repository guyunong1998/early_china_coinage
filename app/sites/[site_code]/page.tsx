import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CoinMapSection } from '@/components/map/CoinMapSection'
import { SiteDetailTabs } from '@/components/site/SiteDetailTabs'
import { CopyButton } from '@/components/ui/CopyButton'
import { DataCard } from '@/components/ui/DataCard'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { formatCoordinates, formatNumber } from '@/lib/format'
import {
  getSite,
  getSiteContexts,
  getSiteFinds,
  getSiteMapSummary,
  getSources,
} from '@/lib/queries'

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

      <div className="mt-8">
        <SiteDetailTabs
          site={site}
          summary={summary}
          contexts={contexts}
          finds={finds}
          sources={sources}
        />
      </div>
    </div>
  )
}
