import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DetailRow } from '@/components/ui/DetailRow'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { CoinIssuesTable } from '@/components/coin-types/CoinIssuesTable'
import { CoinTypeDescriptionSection } from '@/components/coin-types/CoinTypeDescriptionSection'
import { CoinTypeImages } from '@/components/coin-types/CoinTypeImages'
import { MouldTag } from '@/components/coin-types/MouldTag'
import { SubtypeImageGrid } from '@/components/coin-types/SubtypeImageGrid'
import { TypologyTree } from '@/components/coin-types/TypologyTree'
import { T } from '@/components/i18n/T'
import { LabelHint } from '@/components/ui/LabelHint'
import { CollapsiblePanel, Panel } from '@/components/ui/Panel'
import { linkedList } from '@/components/ui/LinkedList'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import {
  buildCoinTypeNodes,
  childrenOf,
  dedupeInscriptions,
  dedupeMints,
  dedupeStates,
  getCoinTypeNodeBySlug,
  isMouldNode,
  type CoinTypeLevel,
} from '@/lib/coin-type-catalog'
import { findMintByNameZh, toMintInfo } from '@/lib/mint-directory'
import {
  getCoinFindsByHierarchyIds,
  getCoinIssuesByHierarchyIds,
  getCoinTypeHierarchy,
  getInscriptions,
  getMapSitesByCodes,
  getMints,
  getStates,
} from '@/lib/queries'
import type { ComboOption } from '@/components/edit/TaxonomyCombobox'

const LEVEL_LABEL_KEY: Record<CoinTypeLevel, DictionaryKey> = {
  level1: 'map.filter.l0',
  level2: 'map.filter.l1',
  level3: 'map.filter.l2',
  level4: 'map.filter.l3',
  level5: 'map.filter.l4',
}

/**
 * Shared render body for both `/coin-types/[type_code]` (public, `authorized`
 * always false so this never touches `cookies()` and stays ISR-eligible) and
 * `/coin-types/[type_code]/edit` (checks the real session, redirects back to
 * the public URL if not an admin). Keeping one copy of the fetch+render logic
 * means the edit route shows exactly the same page, just with edit affordances
 * switched on, instead of drifting into a second maintained view.
 */
export async function CoinTypeDetailContent({
  type_code,
  authorized,
}: {
  type_code: string
  authorized: boolean
}) {
  // Tree structure only (labels/slugs/parents/matchedHierarchyIds/imgAccNum/
  // description) -- none of that depends on coinIssues, so this resolves
  // node_code -> node without pulling the whole coin-issues catalog first.
  const hierarchyRows = await getCoinTypeHierarchy()
  const nodes = buildCoinTypeNodes(hierarchyRows, [])
  // node.slug is sourced straight from this row's own type_code (see
  // lib/coin-type-catalog.ts buildLevel), so this is a direct match against
  // the DB-persisted column, not a recomputed value that only coincidentally
  // agrees with it.
  const node = getCoinTypeNodeBySlug(nodes, type_code)
  if (!node) notFound()

  const { obverseSrc, reverseSrc } = getCoinTypeImagePaths(node.imgAccNum, node.slug)
  // A broad level2/level3 category with no specimen photographed for itself
  // has nothing but a generic silhouette to show — so if it has subtypes,
  // show their obverse photos instead, linked through to each one. Narrower
  // level4/level5 nodes keep the silhouette/placeholder fallback as before.
  const directSubtypes = childrenOf(nodes, node)
  const isGeneralCategory =
    !node.imgAccNum && directSubtypes.length > 0 && (node.level === 'level2' || node.level === 'level3')

  // Every other fetch now scopes directly off node.matchedHierarchyIds
  // instead of paging the full coin_issues/finds/map-sites tables and
  // filtering client-side -- coinIssues and coinFinds are independent scoped
  // queries (v_coin_finds already carries coin_type_id, so finds no longer
  // has to wait on coinIssues to derive an issue-id list first). mints stays
  // a full-table fetch (small table, doubles as the admin combobox's full
  // option list) -- states/inscriptions stay admin-only since they only
  // populate the coin-issue editing comboboxes.
  const [coinIssues, coinFinds, mints, [states, inscriptions]] = await Promise.all([
    getCoinIssuesByHierarchyIds(node.matchedHierarchyIds),
    getCoinFindsByHierarchyIds(node.matchedHierarchyIds),
    getMints(),
    authorized ? Promise.all([getStates(), getInscriptions()]) : Promise.resolve([[], []] as const),
  ])

  const matchedHierarchyIds = new Set(node.matchedHierarchyIds)
  const nodeStates = dedupeStates(coinIssues, matchedHierarchyIds)
  const nodeMints = dedupeMints(coinIssues, matchedHierarchyIds)
  const nodeInscriptions = dedupeInscriptions(coinIssues, matchedHierarchyIds)

  const mintOptions: ComboOption[] = mints.map((m) => ({ value: m.id, label: m.name_zh, searchText: m.name_en ?? '' }))
  const stateOptions: ComboOption[] = states.map((s) => ({ value: s.id, label: s.state_zh, searchText: s.state_en ?? '' }))
  const inscriptionOptions: ComboOption[] = inscriptions.map((i) => ({
    value: i.id,
    label: i.inscription_zh ?? '(no text)',
    searchText: i.inscription_en ?? '',
  }))
  const hierarchyOptions: ComboOption[] = hierarchyRows.map((h) => ({
    value: h.id,
    label: [h.level1_zh, h.level2_zh, h.level3_zh, h.level4_zh, h.level5_zh].filter(Boolean).join(' › '),
  }))

  const matchedSiteCodes = new Set<string>()
  let coinCount = 0
  coinFinds.forEach((f) => {
    coinCount += f.quantity_for_map
    if (f.site_code) matchedSiteCodes.add(f.site_code)
  })
  const counts = { coinCount, siteCount: matchedSiteCodes.size }

  const mintInfos = mints.map(toMintInfo)
  const mintEnByZh = new Map(nodeMints.map((m) => [m.mint_zh, m.mint_en]))
  function resolveMintLink(labelZh: string) {
    const mint = findMintByNameZh(mintInfos, labelZh)
    return { en: mintEnByZh.get(labelZh) ?? null, href: mint ? `/mints/${mint.mint_code}` : null }
  }

  const matchedCoinIssues = [...coinIssues].sort((a, b) =>
    (a.coin_type_code ?? '').localeCompare(b.coin_type_code ?? '')
  )
  const relatedSites = (await getMapSitesByCodes([...matchedSiteCodes])).sort(
    (a, b) => (b.total_quantity_for_map ?? 0) - (a.total_quantity_for_map ?? 0)
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/coin-types" className="text-sm text-brand hover:underline">
          <T k="coinTypeDetail.back" />
        </Link>
        {!authorized && (
          <Link href={`/coin-types/${type_code}/edit`} className="text-sm text-brand hover:underline">
            Edit
          </Link>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h1 className="page-heading">
          {node.label_zh} <span className="text-xl font-normal text-gray-500">({node.label_en})</span>
        </h1>
        <MouldTag isMould={isMouldNode(node)} />
      </div>

      {isGeneralCategory ? (
        <SubtypeImageGrid subtypes={directSubtypes} />
      ) : obverseSrc || reverseSrc ? (
        <CoinTypeImages obverseSrc={obverseSrc} reverseSrc={reverseSrc} accNum={node.imgAccNum} />
      ) : (
        <ImagePlaceholder label={<T k="coinTypeDetail.imagePlaceholder" />} className="mt-4 h-56 w-full rounded" />
      )}

      {/* Information card */}
      <Panel header={<T k="mintDetail.information" />} className="mt-4" bodyClassName="p-4">
        <dl>
          <DetailRow labelKey="coinTypeDetail.row.level" value={<T k={LEVEL_LABEL_KEY[node.level]} />} />
            <DetailRow
              labelKey="coinTypeDetail.row.parentTypes"
              value={linkedList(
                node.parents.map((p) => p.label_zh),
                (labelZh) => {
                  const index = node.parents.findIndex((p) => p.label_zh === labelZh)
                  const parent = node.parents[index]
                  return {
                    en: parent.label_en,
                    // Level 1 (the root, always parents[0]) has no page of its own to link to.
                    href: index > 0 ? `/coin-types/${parent.slug}` : null,
                  }
                }
              )}
            />
            <DetailRow
              labelKey="coinTypeDetail.row.states"
              value={
                nodeStates.length > 0
                  ? nodeStates.map((s) => `${s.state_zh} (${s.state_en})`).join('、')
                  : '—'
              }
            />
            <DetailRow
              labelKey="mintDetail.row.coinsAndSites"
              value={
                counts.coinCount > 0 ? (
                  <Link
                    href={`/search?coinType=${encodeURIComponent(node.label_zh)}`}
                    className="text-brand hover:underline"
                  >
                    <T k="stats.coinsAcrossSites" vars={{ coins: counts.coinCount, sites: counts.siteCount }} />
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <DetailRow
              labelKey="coinTypeDetail.row.mints"
              value={linkedList(
                nodeMints.map((m) => m.mint_zh),
                resolveMintLink
              )}
            />
            <DetailRow
              labelKey="mintDetail.row.inscriptions"
              value={
                nodeInscriptions.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {nodeInscriptions.map((insc) => (
                      <span key={insc.inscription_zh}>
                        {insc.inscription_zh}
                        {insc.inscription_en && insc.inscription_en !== insc.inscription_zh && (
                          <span className="ml-1 text-xs muted-italic">({insc.inscription_en})</span>
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
      </Panel>

      {/* Description — coin_type_hierarchy.description_zh/en on this node's
          own row (see lib/coin-type-catalog.ts ownDescriptionRow), editable
          in dev. */}
      <Panel header={<T k="mintDetail.description" />} className="mt-6">
        <CoinTypeDescriptionSection
          ownHierarchyId={node.ownHierarchyId}
          descriptionZh={node.description_zh}
          descriptionEn={node.description_en}
          isDevMode={authorized}
          noDescriptionLabel={<T k="coinTypeDetail.noDescription" />}
        />
      </Panel>

      {/* Coin issues — collapsible, closed by default, same pattern as Related Finds */}
      <CollapsiblePanel
        header={<T k="coinTypeDetail.issues.title" vars={{ count: matchedCoinIssues.length }} />}
        className="mt-6"
        bodyClassName="p-4"
      >
        {matchedCoinIssues.length === 0 ? (
          <p className="text-sm text-gray-500">
            <T k="coinTypeDetail.issues.noIssues" />
          </p>
        ) : (
          <div className="overflow-x-auto">
            <CoinIssuesTable
              issues={matchedCoinIssues}
              isDevMode={authorized}
              mintOptions={mintOptions}
              stateOptions={stateOptions}
              inscriptionOptions={inscriptionOptions}
              hierarchyOptions={hierarchyOptions}
            />
          </div>
        )}
      </CollapsiblePanel>

      {/* Related finds — collapsible, closed by default */}
      <CollapsiblePanel header={<T k="coinTypeDetail.relatedFinds" />} className="mt-6" bodyClassName="p-4">
        {relatedSites.length === 0 ? (
          <p className="text-sm text-gray-500">
            <T k="coinTypeDetail.noSites" />
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4"><T k="coinTypeDetail.table.site" /></th>
                  <th className="py-2 pr-4"><T k="coinTypeDetail.table.province" /></th>
                  <th className="py-2"><T k="coinTypeDetail.table.quantity" /></th>
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
                        <span className="ml-1.5 text-xs muted-italic">{site.site_name_en}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {site.province_zh ?? '—'}
                      {site.province_en && <span className="ml-1 text-xs muted-italic">({site.province_en})</span>}
                    </td>
                    <td className="py-2 tabular-nums">{site.total_quantity_for_map ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>

      {/* Typology hierarchy — accordion, expanded down to this node */}
      <Panel
        header={<LabelHint labelKey="coinTypeDetail.hierarchy" hintKey="coinTypeDetail.hierarchyHint" />}
        className="mt-6"
        bodyClassName="p-4 pl-8"
      >
        <TypologyTree nodes={nodes} currentSlug={node.slug} />
      </Panel>
    </div>
  )
}
