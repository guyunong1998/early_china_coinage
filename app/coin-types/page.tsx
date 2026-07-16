import { CoinTypeCard } from '@/components/coin-types/CoinTypeCard'
import { T } from '@/components/i18n/T'
import { getCoinTypeImagePaths } from '@/lib/coin-images'
import { getCoinTypes } from '@/lib/queries'

export const metadata = {
  title: 'Coin Types | Early Chinese Coin Finds',
  description: 'Every documented coin type, grouped by major and minor typology, with obverse/reverse photos.',
}

type CoinTypeGroup = {
  key: string
  majorTypeZh: string
  majorTypeEn: string | null
  minorTypeZh: string | null
  minorTypeEn: string | null
  representativeCode: string
  inscriptionCount: number
}

export default async function CoinTypesPage() {
  const coinTypes = await getCoinTypes()

  // Group by major + minor type only — individual inscriptions are rolled up
  // into a single count per group rather than listed one-by-one.
  const groups = new Map<string, CoinTypeGroup>()
  const inscriptionsSeen = new Map<string, Set<string>>()

  coinTypes.forEach((c) => {
    if (!c.major_type_zh) return
    const key = `${c.major_type_zh}::${c.minor_type_zh ?? ''}`

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        majorTypeZh: c.major_type_zh,
        majorTypeEn: c.major_type_en,
        minorTypeZh: c.minor_type_zh,
        minorTypeEn: c.minor_type_en,
        representativeCode: c.coin_type_code,
        inscriptionCount: 0,
      })
      inscriptionsSeen.set(key, new Set())
    }

    const inscription = c.inscription?.trim()
    if (inscription) inscriptionsSeen.get(key)!.add(inscription)
  })

  const sortedGroups = [...groups.values()]
    .map((g) => ({ ...g, inscriptionCount: inscriptionsSeen.get(g.key)!.size }))
    .sort(
      (a, b) =>
        a.majorTypeZh.localeCompare(b.majorTypeZh, 'zh') ||
        (a.minorTypeZh ?? '').localeCompare(b.minorTypeZh ?? '', 'zh')
    )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-brand">
          <T k="nav.coinTypes" />
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {sortedGroups.length} coin types documented, grouped by major and minor typology.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedGroups.map((g) => (
          <CoinTypeCard
            key={g.key}
            majorTypeZh={g.majorTypeZh}
            majorTypeEn={g.majorTypeEn}
            minorTypeZh={g.minorTypeZh}
            minorTypeEn={g.minorTypeEn}
            inscriptionCount={g.inscriptionCount}
            images={getCoinTypeImagePaths(g.representativeCode)}
          />
        ))}
      </div>
    </div>
  )
}
