/**
 * A curated set of {photo, label} pairs for the map-page loading overlay
 * (components/visualizations/MapLoadingOverlay.tsx) — one entry per
 * coin_type_hierarchy node that has a photographed obverse specimen, labeled
 * with that node's deepest defined level (its most specific denomination,
 * not the generic level1 "Coin"/"Coin Mould" root). Hand-generated from a
 * one-off query against coin_type_hierarchy cross-referenced with
 * public/images/type_imgs, since this is static reference data, not
 * something worth a DB round-trip just to paint a loading screen.
 */
export type LoadingCoinType = {
  src: string
  label_zh: string
  label_en: string
}

export const LOADING_COIN_TYPES: LoadingCoinType[] = [
  { src: '/images/type_imgs/1937.179.14623.obv.noscale.jpg', label_zh: '圜钱', label_en: 'Round Coin' },
  { src: '/images/type_imgs/1937.179.14740.obv.noscale.jpg', label_zh: '耸肩空首布', label_en: 'Pointed-Shoulder Hollow-Socket Spade' },
  { src: '/images/type_imgs/1937.179.14758.obv.noscale.jpg', label_zh: '斜肩空首布', label_en: 'Slanted-Shoulder Hollow-Socket Spade' },
  { src: '/images/type_imgs/goldplate.obv.noscale.jpg', label_zh: '金版', label_en: 'Gold Plate' },
  { src: '/images/type_imgs/1937.179.14940.obv.noscale.jpg', label_zh: '燕尾布', label_en: 'Swallow-tailed Spade' },
  { src: '/images/type_imgs/1937.179.14957.obv.noscale.jpg', label_zh: '连布', label_en: 'Linked Spade' },
  { src: '/images/type_imgs/primitivelargeknife.obv.noscale.jpg', label_zh: '原始大型刀币', label_en: 'Primitive Large Knife' },
  { src: '/images/type_imgs/1937.179.14821.obv.noscale.jpg', label_zh: '桥足布', label_en: 'Bridge-foot Spade' },
  { src: '/images/type_imgs/1937.179.18264.obv.noscale.jpg', label_zh: '折背明刀', label_en: 'Angled-back Ming Knife' },
  { src: '/images/type_imgs/1937.179.15526.obv.noscale.jpg', label_zh: '类方足布', label_en: 'Quasi-square-foot Spade' },
  { src: '/images/type_imgs/1937.179.15054.obv.noscale.jpg', label_zh: '大尖足布', label_en: 'Large Pointed-foot Spade' },
  { src: '/images/type_imgs/1937.179.15036.obv.noscale.jpg', label_zh: '三孔布', label_en: 'Three-hole Spade' },
  { src: '/images/type_imgs/1937.179.16191.obv.noscale.jpg', label_zh: '大方足布', label_en: 'Large Square-foot Spade' },
  { src: '/images/type_imgs/1937.179.14760.obv.noscale.jpg', label_zh: '小型平肩空首布', label_en: 'Small Flat-Shoulder Hollow-socket Spade' },
  { src: '/images/type_imgs/1937.179.14732.obv.noscale.jpg', label_zh: '大型平肩空首布', label_en: 'Large Flat-Shoulder Hollow-socket Spade' },
  { src: '/images/type_imgs/1937.179.18273.obv.noscale.jpg', label_zh: '弧背明刀', label_en: 'Curved-back Ming Knife' },
  { src: '/images/type_imgs/1926.79.17.obv.noscale.jpg', label_zh: '大锐角布', label_en: 'Large Sharp-cornered Spade' },
  { src: '/images/type_imgs/1957.187.324.obv.noscale.jpg', label_zh: '针首刀', label_en: 'Needle-tip Knife' },
  { src: '/images/type_imgs/1937.179.15477.obv.noscale.jpg', label_zh: '类圆足布', label_en: 'Quasi-square-foot Spade' },
  { src: '/images/type_imgs/1910.46.2.obv.noscale.jpg', label_zh: '蚁鼻钱', label_en: 'Ant-nose Coin' },
  { src: '/images/type_imgs/1937.179.15769.obv.noscale.jpg', label_zh: '锐角布', label_en: 'Sharp-cornered Spade' },
  { src: '/images/type_imgs/1937.179.17300.obv.noscale.jpg', label_zh: '齐大刀', label_en: 'Qi large Knife' },
  { src: '/images/type_imgs/1937.179.17452.obv.noscale.jpg', label_zh: '尖首刀', label_en: 'Pointed-tip Knife' },
  { src: '/images/type_imgs/1937.179.17639.obv.noscale.jpg', label_zh: '直刀', label_en: 'Straight-back Knife' },
  { src: '/images/type_imgs/1937.179.18060.obv.noscale.jpg', label_zh: '明刀', label_en: 'Ming Knife' },
  { src: '/images/type_imgs/1937.179.16804.obv.noscale.jpg', label_zh: '方足布', label_en: 'Square-foot Spade' },
  { src: '/images/type_imgs/1937.179.15014.obv.noscale.jpg', label_zh: '圆足布', label_en: 'Round-foot Spade' },
  { src: '/images/type_imgs/goldcake.obv.noscale.jpg', label_zh: '金饼', label_en: 'Gold cake' },
  { src: '/images/type_imgs/horsehoofgold.obv.noscale.jpg', label_zh: '马蹄金', label_en: 'Horse-hoof gold' },
  { src: '/images/type_imgs/qimingknife.obv.noscale.jpg', label_zh: '齐明刀', label_en: 'Qi-Ming Knife' },
  { src: '/images/type_imgs/shishoupingjianbu.obv.noscale.jpg', label_zh: '实首平肩布', label_en: 'Flat-Shoulder Solid-head Spade' },
  { src: '/images/type_imgs/1937.179.15655.obv.noscale.jpg', label_zh: '尖足布', label_en: 'Pointed-foot Spade' },
]

export function pickRandomLoadingCoinType(): LoadingCoinType {
  return LOADING_COIN_TYPES[Math.floor(Math.random() * LOADING_COIN_TYPES.length)]
}
