import Link from 'next/link'
import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { DemoVisualizationsCarousel } from '@/components/home/DemoVisualizationsCarousel'
import { Level2TypeShowcase, type Level2TypeShowcaseItem } from '@/components/home/Level2TypeShowcase'
import { T } from '@/components/i18n/T'

// One representative specimen photo per level2 coin-type category (level1
// 钱币, moulds excluded) — hardcoded so the home page needs no database
// query. Regenerate by re-running the query in the "make no queries" task
// if coin_type_hierarchy's img_acc_num values change.
const showcaseItems: Level2TypeShowcaseItem[] = [
  { slug: 'spade-coin', label_zh: '布币', label_en: 'Spade Coin', obverseSrc: '/images/type_imgs/1937.179.14740.obv.noscale.jpg' },
  { slug: 'knife-shaped-coin', label_zh: '刀币', label_en: 'Knife-Shaped Coin', obverseSrc: '/images/type_imgs/primitivelargeknife.obv.noscale.jpg' },
  { slug: 'round-coin', label_zh: '圜钱', label_en: 'Round Coin', obverseSrc: '/images/type_imgs/1937.179.14623.obv.noscale.jpg' },
  { slug: 'gold-plate', label_zh: '金版', label_en: 'Gold Plate', obverseSrc: '/images/type_imgs/goldplate.obv.noscale.jpg' },
  { slug: 'gold-cake', label_zh: '金饼', label_en: 'Gold Cake', obverseSrc: '/images/type_imgs/goldcake.obv.noscale.jpg' },
  { slug: 'horse-hoof-gold', label_zh: '马蹄金', label_en: 'Horse-hoof Gold', obverseSrc: '/images/type_imgs/horsehoofgold.obv.noscale.jpg' },
  { slug: 'ant-nose-coin', label_zh: '蚁鼻钱', label_en: 'Ant-nose Coin', obverseSrc: '/images/type_imgs/1910.46.2.obv.noscale.jpg' },
]

export const revalidate = 86400

export default function Home() {
  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <NavCards />
        </div>
        <DemoVisualizationsCarousel />

        {/* Coin types teaser — same left/right split as the Map
            Visualizations section above, just with the preview as the
            larger two-thirds since it's the whole point here. Each side is
            its own bordered box rather than sharing one outer frame,
            matching the Map Visualizations split above. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="panel-nav-card overflow-hidden p-4 lg:col-span-2">
            <Level2TypeShowcase items={showcaseItems} />
          </div>
          <div className="panel-nav-card flex flex-col p-3 lg:col-span-1">
            <div className="panel-nav-card-inner flex flex-1 flex-col justify-center gap-0 p-4">
              <h2 className="section-heading">
                <T k="nav.coinTypes" />
              </h2>
              <p className="text-sm leading-6 text-gray-600">
                <T k="navcards.coinTypes.desc" />
              </p>
              <Link
                href="/coin-types"
                className="mt-4 inline-block w-fit btn-outline transition"
              >
                <T k="home.coinTypesSection.title" /> →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
