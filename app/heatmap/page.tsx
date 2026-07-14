import { CoinTypeHeatmapMap } from '@/components/heatmap/CoinTypeHeatmapMap'
import { CoinTypeCard } from '@/components/heatmap/CoinTypeCard'
import { Pagination } from '@/components/ui/Pagination'
import { T } from '@/components/i18n/T'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import { getCoinTypes, getFindsForHeatmap, getMapSites } from '@/lib/queries'
import type { CoinType } from '@/lib/types'

const PAGE_SIZE = 24

type PageProps = {
  searchParams: Promise<{ page?: string }>
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'type'
}

/** The browse grid shows one card per major category — the dropdown filter
 * above it is the place for minor-type/inscription granularity. */
function groupByMajorType(coinTypes: CoinType[]): CoinType[] {
  const map = new Map<string, CoinType>()
  coinTypes.forEach((c) => {
    if (!c.major_type_zh) return
    const existing = map.get(c.major_type_zh)
    if (!existing) {
      map.set(c.major_type_zh, {
        coin_type_code: `major-${slugify(c.major_type_en || c.major_type_zh)}`,
        major_type_zh: c.major_type_zh,
        major_type_en: c.major_type_en,
        minor_type_zh: null,
        minor_type_en: null,
        inscription: null,
        inscription_en: null,
        mint_zh: null,
        mint_en: null,
        state_zh: null,
        state_en: null,
        description_zh: c.description_zh,
        description_en: c.description_en,
      })
    } else {
      if (!existing.major_type_en && c.major_type_en) existing.major_type_en = c.major_type_en
      if (!existing.description_zh && c.description_zh) existing.description_zh = c.description_zh
      if (!existing.description_en && c.description_en) existing.description_en = c.description_en
    }
  })
  return [...map.values()].sort((a, b) => (a.major_type_zh ?? '').localeCompare(b.major_type_zh ?? ''))
}

export default async function HeatmapPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const [coinTypes, mapSites, finds] = await Promise.all([
    getCoinTypes(),
    getMapSites(),
    getFindsForHeatmap(),
  ])

  const majorTypeCards = groupByMajorType(coinTypes)
  const totalPages = Math.max(1, Math.ceil(majorTypeCards.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages)
  const pageCoinTypes = majorTypeCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="heatmap.title" />
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          <T k="heatmap.description" />
        </p>
      </div>

      <div className="mb-8">
        <CoinTypeHeatmapMap coinTypes={coinTypes} mapSites={mapSites} finds={finds} />
      </div>

      <h2 className="mb-4 font-serif text-2xl font-semibold text-brand">
        <T k="heatmap.browseTitle" />
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageCoinTypes.map((coinType) => (
          <CoinTypeCard
            key={coinType.coin_type_code}
            coinType={coinType}
            images={getCoinTypeImagePaths(coinType.coin_type_code)}
          />
        ))}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(p) => `/heatmap${p === 1 ? '' : `?page=${p}`}`}
      />
    </div>
  )
}
