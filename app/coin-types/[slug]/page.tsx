import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DetailRow } from '@/components/ui/DetailRow'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { CoinTypeImages } from '@/components/coin-types/CoinTypeImages'
import { MouldTag } from '@/components/coin-types/MouldTag'
import { TypologyTree } from '@/components/coin-types/TypologyTree'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import {
  buildCoinTypeNodes,
  computeCoinTypeCounts,
  getCoinTypeNodeBySlug,
  isMouldNode,
  type CoinTypeLevel,
} from '@/lib/coin-type-catalog'
import { getCoinIssues, getCoinTypeHierarchy, getFindSpotsMapSites, getFindsForHeatmap } from '@/lib/queries'

type PageProps = {
  params: Promise<{ slug: string }>
}

const LEVEL_LABEL_KEY: Record<CoinTypeLevel, DictionaryKey> = {
  level1: 'map.filter.l0',
  level2: 'map.filter.l1',
  level3: 'map.filter.l2',
  level4: 'map.filter.l3',
  level5: 'map.filter.l4',
}

export async function generateStaticParams() {
  const hierarchyRows = await getCoinTypeHierarchy()
  // Slugs/labels/parents don't depend on coinIssues — only states/mints/
  // inscriptions dedup does, which generateStaticParams doesn't need.
  const nodes = buildCoinTypeNodes(hierarchyRows, [])
  return nodes.map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const hierarchyRows = await getCoinTypeHierarchy()
  const node = getCoinTypeNodeBySlug(buildCoinTypeNodes(hierarchyRows, []), slug)
  if (!node) return { title: 'Not found' }
  return {
    title: `${node.label_zh} ${node.label_en} | Coin Types`,
    description: `${node.label_en} (${node.label_zh}) — typology, related finds, inscriptions, and mints.`,
  }
}

export default async function CoinTypeDetailPage({ params }: PageProps) {
  const { slug } = await params

  const [coinIssues, hierarchyRows, finds, sites] = await Promise.all([
    getCoinIssues(),
    getCoinTypeHierarchy(),
    getFindsForHeatmap(),
    getFindSpotsMapSites(),
  ])

  const nodes = buildCoinTypeNodes(hierarchyRows, coinIssues)
  const node = getCoinTypeNodeBySlug(nodes, slug)
  if (!node) notFound()

  const { obverseSrc, reverseSrc } = getCoinTypeImagePaths(node.imgAccNum, node.slug)

  const hierarchyIdByIssueId = new Map(coinIssues.map((c) => [c.id, c.coin_type_hierarchy_id]))
  const counts = computeCoinTypeCounts(node.matchedHierarchyIds, finds, hierarchyIdByIssueId)

  const matchedIds = new Set(node.matchedHierarchyIds)
  const matchedCoinIssues = coinIssues
    .filter((c) => c.coin_type_hierarchy_id && matchedIds.has(c.coin_type_hierarchy_id))
    .sort((a, b) => a.coin_type_code.localeCompare(b.coin_type_code))
  const matchedIssueIds = new Set(matchedCoinIssues.map((c) => c.id))
  const matchedSiteCodes = new Set<string>()
  finds.forEach((f) => {
    if (f.coin_issues_id && matchedIssueIds.has(f.coin_issues_id) && f.site_code) {
      matchedSiteCodes.add(f.site_code)
    }
  })
  const relatedSites = sites
    .filter((s) => matchedSiteCodes.has(s.site_code))
    .sort((a, b) => (b.total_quantity_for_map ?? 0) - (a.total_quantity_for_map ?? 0))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <Link href="/coin-types" className="text-sm text-brand hover:underline">
          <T k="coinTypeDetail.back" />
        </Link>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          {node.label_zh} <span className="text-xl font-normal text-gray-500">({node.label_en})</span>
        </h1>
        <MouldTag isMould={isMouldNode(node)} />
      </div>

      {obverseSrc || reverseSrc ? (
        <CoinTypeImages obverseSrc={obverseSrc} reverseSrc={reverseSrc} accNum={node.imgAccNum} />
      ) : (
        <ImagePlaceholder label={<T k="coinTypeDetail.imagePlaceholder" />} className="mt-4 h-56 w-full rounded" />
      )}

      {/* Information card */}
      <section className="panel mt-4 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="mintDetail.information" />
        </div>
        <div className="p-4">
          <dl>
            <DetailRow labelKey="coinTypeDetail.row.level" value={<T k={LEVEL_LABEL_KEY[node.level]} />} />
            <DetailRow
              labelKey="coinTypeDetail.row.parentTypes"
              value={
                node.parents.length > 0
                  ? node.parents.map((p) => `${p.label_zh} (${p.label_en})`).join('、')
                  : '—'
              }
            />
            <DetailRow
              labelKey="coinTypeDetail.row.states"
              value={
                node.states.length > 0
                  ? node.states.map((s) => `${s.state_zh} (${s.state_en})`).join('、')
                  : '—'
              }
            />
            <DetailRow
              labelKey="mintDetail.row.coinsAndSites"
              value={counts.coinCount > 0 ? `${counts.coinCount} coins across ${counts.siteCount} sites` : '—'}
            />
            <DetailRow
              labelKey="coinTypeDetail.row.mints"
              value={
                node.mints.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {node.mints.map((m) => (
                      <span
                        key={m.mint_zh}
                        className="rounded border border-brand/20 bg-brand-light px-2 py-0.5 text-xs text-brand"
                      >
                        {m.mint_zh}
                        {m.mint_en && <span className="italic text-brand/70"> ({m.mint_en})</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                )
              }
            />
            <DetailRow
              labelKey="mintDetail.row.inscriptions"
              value={
                node.inscriptions.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {node.inscriptions.map((insc) => (
                      <span key={insc.inscription_zh}>
                        {insc.inscription_zh}
                        {insc.inscription_en && insc.inscription_en !== insc.inscription_zh && (
                          <span className="ml-1 text-xs italic text-gray-400">({insc.inscription_en})</span>
                        )}
                        {insc.mint_zh && <span className="ml-1 text-xs text-gray-400">— {insc.mint_zh}</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </div>
      </section>

      {/* Description placeholder — no curated text source for typology
          nodes yet (unlike mint dossiers); keeps the same "not recorded
          yet" pattern the mint detail page uses. */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="mintDetail.description" />
        </div>
        <div className="p-5">
          <p className="text-sm italic text-gray-400">
            <T k="coinTypeDetail.noDescription" />
          </p>
        </div>
      </section>

      {/* Coin issues — collapsible, closed by default, same pattern as Related Finds */}
      <details className="group panel panel-collapsible mt-6 overflow-hidden">
        <summary className="panel-header flex list-none cursor-pointer items-center justify-between px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeDetail.issues.title" vars={{ count: matchedCoinIssues.length }} />
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="p-4">
          {matchedCoinIssues.length === 0 ? (
            <p className="text-sm text-gray-500">
              <T k="coinTypeDetail.issues.noIssues" />
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Inscription</th>
                    <th className="py-2 pr-4">State</th>
                    <th className="py-2 pr-4">Mint</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedCoinIssues.map((issue) => {
                    const typeZh = issue.minor_type_zh ?? issue.major_type_zh
                    const typeEn = issue.minor_type_zh ? issue.minor_type_en : issue.major_type_en
                    return (
                      <tr key={issue.id} className="border-b border-gray-50 align-top">
                        <td className="py-2 pr-4 font-mono text-xs">{issue.coin_type_code}</td>
                        <td className="py-2 pr-4 text-gray-600">
                          {typeZh ?? '—'}
                          {typeEn && <span className="ml-1 text-xs italic text-gray-400">({typeEn})</span>}
                        </td>
                        <td className="py-2 pr-4">
                          {issue.inscription ?? '—'}
                          {issue.inscription_en && issue.inscription_en !== issue.inscription && (
                            <span className="ml-1 text-xs italic text-gray-400">({issue.inscription_en})</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {issue.state_zh ?? '—'}
                          {issue.state_en && <span className="ml-1 text-xs italic text-gray-400">({issue.state_en})</span>}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {issue.mint_zh ?? '—'}
                          {issue.mint_en && <span className="ml-1 text-xs italic text-gray-400">({issue.mint_en})</span>}
                        </td>
                        <td className="py-2 text-gray-600">
                          {issue.description_zh && <div>{issue.description_zh}</div>}
                          {issue.description_en && (
                            <div className={issue.description_zh ? 'italic text-gray-400' : undefined}>
                              {issue.description_en}
                            </div>
                          )}
                          {!issue.description_zh && !issue.description_en && '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* Related finds — collapsible, closed by default */}
      <details className="group panel panel-collapsible mt-6 overflow-hidden">
        <summary className="panel-header flex list-none cursor-pointer items-center justify-between px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeDetail.relatedFinds" />
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="p-4">
          {relatedSites.length === 0 ? (
            <p className="text-sm text-gray-500">
              <T k="coinTypeDetail.noSites" />
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-4">Site</th>
                    <th className="py-2 pr-4">Province</th>
                    <th className="py-2">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedSites.map((site) => (
                    <tr key={site.site_code} className="border-b border-gray-50">
                      <td className="py-2 pr-4">
                        <Link href={`/sites/${site.site_code}`} className="text-brand hover:underline">
                          {site.site_name_zh ?? site.site_code}
                        </Link>
                        {site.site_name_en && (
                          <span className="ml-1.5 text-xs italic text-gray-400">{site.site_name_en}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {site.province_zh ?? '—'}
                        {site.province_en && <span className="ml-1 text-xs italic text-gray-400">({site.province_en})</span>}
                      </td>
                      <td className="py-2 tabular-nums">{site.total_quantity_for_map ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* Typology hierarchy — accordion, expanded down to this node */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeDetail.hierarchy" />
        </div>
        <div className="p-4 pl-8">
          <TypologyTree nodes={nodes} currentSlug={node.slug} />
        </div>
      </section>
    </div>
  )
}
