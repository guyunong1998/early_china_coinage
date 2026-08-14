import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CoinMapSection } from '@/components/map/CoinMapSection'
import { HoardMintOriginsMap, type HoardMintOrigin } from '@/components/map/HoardMintOriginsMap'
import { SiteDetailTabs } from '@/components/site/SiteDetailTabs'
import { SiteRecordSection } from '@/components/site/SiteRecordSection'
import { ClickHint } from '@/components/ui/ClickHint'
import { CopyButton } from '@/components/ui/CopyButton'
import { DataCard } from '@/components/ui/DataCard'
import { LabelHint } from '@/components/ui/LabelHint'
import { linkedList } from '@/components/ui/LinkedList'
import { T } from '@/components/i18n/T'
import { isAuthorized } from '@/lib/admin/guard'
import { resolveSourceLinkTargets } from '@/lib/admin/resolve-source-link-target'
import { buildCoinTypeNodes, type CoinTypeLevel } from '@/lib/coin-type-catalog'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { formatCoordinates, formatNumber, splitCsv } from '@/lib/format'
import { findMintByNameZh, toMintInfo } from '@/lib/mint-directory'
import {
  getCoinIssues,
  getCoinTypeHierarchy,
  getMints,
  getSite,
  getSiteContexts,
  getSiteFinds,
  getSiteMapSummary,
  getSourceLinksForSite,
  getSources,
} from '@/lib/queries'
import type { Find, MapSite, MintInfo } from '@/lib/types'

const LEVEL_RANK: Record<CoinTypeLevel, number> = { level1: 1, level2: 2, level3: 3, level4: 4, level5: 5 }

type PageProps = {
  params: Promise<{ site_code: string }>
}

const UNKNOWN_MINT_TOKENS = ['未知', '不详', '无', '—', '-', 'n/a', 'na', 'unknown', '']

function findQuantity(find: Find) {
  return find.quantity_total ?? find.quantity_estimated ?? find.quantity_min ?? 0
}

function coinTypeLabel(find: Find) {
  return (
    find.coin_issues?.inscription?.trim() ||
    find.coin_issues?.minor_type_zh?.trim() ||
    find.coin_issues?.major_type_zh?.trim() ||
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
function buildMintOrigins(
  finds: Find[],
  mints: MintInfo[]
): {
  matched: HoardMintOrigin[]
  unmatched: MintOriginGroup[]
} {
  const groups = new Map<string, MintOriginGroup>()

  finds.forEach((find) => {
    const mintZh = find.coin_issues?.mint_zh?.trim() ?? ''
    if (UNKNOWN_MINT_TOKENS.includes(mintZh.toLowerCase())) return

    if (!groups.has(mintZh)) {
      groups.set(mintZh, {
        mint_zh: mintZh,
        mint_en: find.coin_issues?.mint_en ?? null,
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
    const mint = findMintByNameZh(mints, group.mint_zh)
    if (mint && mint.lat != null && mint.lng != null) {
      matched.push({
        mint_code: mint.mint_code,
        mint_zh: group.mint_zh,
        mint_en: group.mint_en ?? mint.name_en,
        lat: mint.lat,
        lng: mint.lng,
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

type BilingualPair = { zh: string; en: string | null }

/** Distinct zh→en pairs pulled straight off each find's own coin_issues
 * join — unlike the pre-joined `inscriptions`/`states_zh` CSV columns on
 * the map-summary view (two independently aggregated strings with no
 * guaranteed shared ordering), pairing zh and en from the same row is
 * always correct. */
function collectPairs(items: { zh: string | null | undefined; en: string | null | undefined }[]): BilingualPair[] {
  const seen = new Map<string, string | null>()
  items.forEach(({ zh, en }) => {
    const z = zh?.trim()
    if (z && !seen.has(z)) seen.set(z, en?.trim() || null)
  })
  return [...seen.entries()]
    .map(([zh, en]) => ({ zh, en }))
    .sort((a, b) => a.zh.localeCompare(b.zh, 'zh-CN'))
}

/** A '、'-joined list of "zh (en)" pairs — same per-item reading as
 * linkedList's coin-type/mint labels, for fields (inscriptions, states)
 * that don't resolve to a linkable detail page of their own. */
function bilingualList(pairs: BilingualPair[]) {
  if (pairs.length === 0) return <span className="text-gray-400">—</span>
  return (
    <>
      {pairs.map(({ zh, en }, i) => (
        <span key={zh}>
          {i > 0 && '、'}
          <span className="text-gray-800">{zh}</span>
          {en && en !== zh && <span className="ml-1 text-xs italic text-gray-400">({en})</span>}
        </span>
      ))}
    </>
  )
}

/** level1 buckets ('钱币' Coin, '钱范' Coin Mould) are the taxonomy's generic
 * top category, not a specific type — every other classification label on
 * a site is already one of their descendants, so showing these alongside
 * them is redundant noise rather than information. */
const GENERIC_LEVEL1_LABELS = new Set(['钱币', '钱范'])

/** Union of the site's populated coin_type_hierarchy levels (level1..level5 —
 * Coin/Mould, Category, Type, Subtype, Variant), deduped and flattened into
 * one bilingual list — the level split is a taxonomy implementation detail,
 * not something a site's classification summary needs to spell out row by
 * row. */
function mergeLevelTypes(summary: MapSite | null): { zh: string | null; en: string | null } {
  const zhLists = [
    summary?.level1_types_zh,
    summary?.level2_types_zh,
    summary?.level3_types_zh,
    summary?.level4_types_zh,
    summary?.level5_types_zh,
  ]
  const enLists = [
    summary?.level1_types_en,
    summary?.level2_types_en,
    summary?.level3_types_en,
    summary?.level4_types_en,
    summary?.level5_types_en,
  ]
  const zh = [...new Set(zhLists.flatMap((s) => (s ? s.split('、') : [])))]
  const en = [...new Set(enLists.flatMap((s) => (s ? s.split('、') : [])))]
  return { zh: zh.length ? zh.join('、') : null, en: en.length ? en.join(', ') : null }
}

// ── row component ─────────────────────────────────────────────────────────

function Row({
  labelKey,
  hintKey,
  children,
}: {
  labelKey: DictionaryKey
  hintKey?: DictionaryKey
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <dt className="text-right text-sm font-semibold text-gray-700">
        {hintKey ? <LabelHint labelKey={labelKey} hintKey={hintKey} /> : <T k={labelKey} />}
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

  const authorized = await isAuthorized()
  const summary = await getSiteMapSummary(site_code)
  const contexts = await getSiteContexts(site_code)
  const finds = await getSiteFinds(contexts.map((c) => c.context_code))
  const mints = (await getMints()).map(toMintInfo)

  // Only needed to populate the find-editing combobox, so skip the fetch in prod.
  const coinIssues = authorized ? await getCoinIssues() : []
  // For linking "Coin Types" labels below through to their /coin-types page.
  const catalogNodes = buildCoinTypeNodes(await getCoinTypeHierarchy(), coinIssues)

  const structuredSourceLinks = await getSourceLinksForSite(
    site_code,
    contexts.map((c) => c.context_code),
    finds.map((f) => f.find_code)
  )
  const [structuredSources, resolvedTargets] = await Promise.all([
    getSources(structuredSourceLinks.map((l) => l.source_code)),
    resolveSourceLinkTargets(structuredSourceLinks),
  ])
  const sourcesByCode = new Map(structuredSources.map((s) => [s.source_code, s]))

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
  const classification = mergeLevelTypes(summary)
  const classificationItems = classification.zh
    ? classification.zh.split('、').filter((label) => !GENERIC_LEVEL1_LABELS.has(label))
    : []
  const mintItems = splitCsv(summary?.mints_zh)
  const inscriptionPairs = collectPairs(
    finds.map((f) => ({ zh: f.coin_issues?.inscription, en: f.coin_issues?.inscription_en }))
  )
  const statePairs = collectPairs(finds.map((f) => ({ zh: f.coin_issues?.state_zh, en: f.coin_issues?.state_en })))

  function resolveCoinType(labelZh: string) {
    const node = catalogNodes
      .filter((n) => n.label_zh === labelZh)
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])[0]
    return { en: node?.label_en ?? null, href: node ? `/coin-types/${node.slug}` : null }
  }

  function resolveMint(labelZh: string) {
    const mint = findMintByNameZh(mints, labelZh)
    return { en: mint?.name_en ?? null, href: mint ? `/mints/${mint.mint_code}` : null }
  }

  // For linking each find row's Type/Mint cell in the Finds tab straight to
  // its /coin-types and /mints record, keyed by the ids coin_issues already
  // carries rather than by label text (exact, no name-matching ambiguity).
  // A hierarchy_id can belong to more than one node's matchedHierarchyIds
  // (a node and its ancestors) — keep the deepest, same tie-break as
  // resolveCoinType above.
  const deepestNodeByHierarchyId = new Map<string, (typeof catalogNodes)[number]>()
  catalogNodes.forEach((node) => {
    node.matchedHierarchyIds.forEach((id) => {
      const existing = deepestNodeByHierarchyId.get(id)
      if (!existing || LEVEL_RANK[node.level] > LEVEL_RANK[existing.level]) {
        deepestNodeByHierarchyId.set(id, node)
      }
    })
  })
  const coinTypeHrefByHierarchyId = new Map(
    [...deepestNodeByHierarchyId.entries()].map(([id, node]) => [id, `/coin-types/${node.slug}`])
  )
  const mintHrefByMintId = new Map(mints.map((m) => [m.id, `/mints/${m.mint_code}`]))

  const mintOrigins =
    summary?.lat != null && summary.lng != null ? buildMintOrigins(finds, mints) : null

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
                singlePin
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              <T k="site.descriptionLabel" />
            </p>
            {biBlock(infoTextZh, infoTextEn)}
          </div>
        </DataCard>
      </div>

      <div className="mt-6">
        <DataCard title={<T k="site.classification.title" />}>
          <div className="grid gap-6 lg:grid-cols-2">
            <dl>
              <Row labelKey="site.row.classification">{linkedList(classificationItems, resolveCoinType)}</Row>
              <Row labelKey="siteTabs.row.inscriptions">{bilingualList(inscriptionPairs)}</Row>
            </dl>
            <dl>
              <Row labelKey="siteTabs.row.states">{bilingualList(statePairs)}</Row>
              <Row labelKey="siteTabs.row.mints">{linkedList(mintItems, resolveMint)}</Row>
              <Row labelKey="siteTabs.row.precision" hintKey="siteTabs.row.precisionHint">
                {formatNumber(site.precision_level ?? summary?.precision_level)}
              </Row>
            </dl>
          </div>
        </DataCard>
      </div>

      {mintOrigins && mintOrigins.matched.length > 0 && (
        <div className="mt-6">
          <DataCard title={<T k="site.mintOrigins.title" />}>
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
                <T k="site.mintOrigins.caption" />
              </p>
            </div>
            {mintOrigins.unmatched.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                <ClickHint
                  hint={mintOrigins.unmatched
                    .map((m) => (m.mint_en ? `${m.mint_zh} (${m.mint_en})` : m.mint_zh))
                    .join('、')}
                  className="cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2"
                >
                  <T k="site.mintOrigins.unmapped" vars={{ count: mintOrigins.unmatched.length }} /> ⓘ
                </ClickHint>
              </p>
            )}
          </DataCard>
        </div>
      )}

      {authorized && (
        <div className="mt-6">
          <DataCard title="Site Record (dev only)">
            <SiteRecordSection site={site} />
          </DataCard>
        </div>
      )}

      <div className="mt-8">
        <SiteDetailTabs
          siteCode={site_code}
          contexts={contexts}
          finds={finds}
          isDevMode={authorized}
          coinIssues={coinIssues}
          structuredSourceLinks={structuredSourceLinks}
          sourcesByCode={sourcesByCode}
          resolvedTargets={resolvedTargets}
          coinTypeHrefByHierarchyId={coinTypeHrefByHierarchyId}
          mintHrefByMintId={mintHrefByMintId}
        />
      </div>
    </div>
  )
}
