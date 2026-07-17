import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DetailRow } from '@/components/ui/DetailRow'
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder'
import { MouldTag } from '@/components/coin-types/MouldTag'
import { TypologyTree } from '@/components/coin-types/TypologyTree'
import { T } from '@/components/i18n/T'
import type { DictionaryKey } from '@/lib/i18n/dictionary'
import {
  COIN_TYPE_NODES,
  computeCoinTypeCounts,
  getCoinTypeNodeBySlug,
  type CoinTypeLevel,
} from '@/lib/coin-type-catalog'
import { getCoinTypes, getFindSpotsMapSites, getFindsForHeatmap } from '@/lib/queries'
import { getMatchingCoinTypeCodes } from '@/lib/typology-filter'

type PageProps = {
  params: Promise<{ slug: string }>
}

const LEVEL_LABEL_KEY: Record<CoinTypeLevel, DictionaryKey> = {
  l1: 'map.filter.l1',
  l2: 'map.filter.l2',
  l3: 'map.filter.l3',
  l4: 'map.filter.l4',
}

export async function generateStaticParams() {
  return COIN_TYPE_NODES.map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const node = getCoinTypeNodeBySlug(slug)
  if (!node) return { title: 'Not found' }
  return {
    title: `${node.label_zh} ${node.label_en} | Coin Types`,
    description: `${node.label_en} (${node.label_zh}) — typology, related finds, inscriptions, and mints.`,
  }
}

export default async function CoinTypeDetailPage({ params }: PageProps) {
  const { slug } = await params
  const node = getCoinTypeNodeBySlug(slug)
  if (!node) notFound()

  const [coinTypes, finds, sites] = await Promise.all([
    getCoinTypes(),
    getFindsForHeatmap(),
    getFindSpotsMapSites(),
  ])

  const counts = computeCoinTypeCounts(node.sel, finds, coinTypes)

  const matchedCodes = getMatchingCoinTypeCodes(coinTypes, node.sel)
  const matchedSiteCodes = new Set<string>()
  finds.forEach((f) => {
    if (f.coin_type_code && matchedCodes?.has(f.coin_type_code) && f.site_code) {
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
        <MouldTag />
      </div>

      <ImagePlaceholder label={<T k="coinTypeDetail.imagePlaceholder" />} className="mt-4 h-56 w-full rounded" />

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
              value={node.states.length > 0 ? node.states.map((s) => s.state_zh).join('、') : '—'}
            />
            <DetailRow
              labelKey="mintDetail.row.coinsAndSites"
              value={counts.coinCount > 0 ? `${counts.coinCount} coins across ${counts.siteCount} sites` : '—'}
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

      {/* Inscriptions + Mints */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
            <T k="mintDetail.row.inscriptions" />
          </div>
          <div className="p-4">
            {node.inscriptions.length === 0 ? (
              <p className="text-sm text-gray-500">—</p>
            ) : (
              <ul className="space-y-1 text-sm text-gray-800">
                {node.inscriptions.map((insc) => (
                  <li key={insc.inscription_zh}>
                    {insc.inscription_zh}
                    {insc.inscription_en && insc.inscription_en !== insc.inscription_zh && (
                      <span className="ml-1.5 text-xs italic text-gray-400">({insc.inscription_en})</span>
                    )}
                    {insc.mint_zh && <span className="ml-1.5 text-xs text-gray-400">— {insc.mint_zh}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
            <T k="coinTypeDetail.row.mints" />
          </div>
          <div className="p-4">
            {node.mints.length === 0 ? (
              <p className="text-sm text-gray-500">—</p>
            ) : (
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
            )}
          </div>
        </section>
      </div>

      {/* Related finds */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeDetail.relatedFinds" />
        </div>
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
                      <td className="py-2 pr-4 text-gray-600">{site.province_zh ?? '—'}</td>
                      <td className="py-2 tabular-nums">{site.total_quantity_for_map ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Typology hierarchy — accordion, expanded down to this node */}
      <section className="panel mt-6 overflow-hidden">
        <div className="panel-header px-4 py-2 text-sm font-bold uppercase tracking-wide">
          <T k="coinTypeDetail.hierarchy" />
        </div>
        <div className="p-4">
          <TypologyTree currentSlug={node.slug} />
        </div>
      </section>
    </div>
  )
}
