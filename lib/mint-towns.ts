export type MintReference = {
  citation_zh: string
  citation_en?: string
  url?: string
}

export type MintImage = {
  src: string        // path under /public, e.g. /images/mints/anyi-plan.png
  caption?: string
  credit?: string
}

export type MintTown = {
  mint_code: string
  name_zh: string
  name_en: string
  state_zh: string
  state_en: string
  modern_location_en: string
  lat: number
  lng: number
  description_en: string
  coin_types: string[]
  references: MintReference[]
  images?: MintImage[]
}

export const MINT_TOWNS: MintTown[] = [
  {
    mint_code: 'anyi',
    name_zh: '安邑',
    name_en: 'Anyi',
    state_zh: '魏',
    state_en: 'Wei',
    modern_location_en: 'Xia County, Yuncheng, Shanxi',
    lat: 35.18071997991436,
    lng: 111.16366245816664,
    description_en:
      'Located 7.5 km northwest of Xia County, near Yuwang Village. The city consists of three enclosures, with circumferences of roughly 15.5 km, 6.5 km, and 3 km. Numerous Warring States and Han Period deposits have been found within the city (Tao and Ye 1962). Near the Miaohouzhuang village, archaeologists found the mould used to cast bridge-foot spade coins, providing direct evidence for coin production (Zhang and Huang 1993).',
    coin_types: ['Bridge-foot spades'],
    references: [
      {
        citation_zh:
          '陶正刚、叶学明：《古魏城和禹王古城调查简报》，《考古》1962年第1期。',
        citation_en:
          'Tao Zhenggang and Ye Xueming, "Survey Report on the Ancient Wei City and Yuwang City," Kaogu, no. 1 (1962).',
      },
      {
        citation_zh:
          '张童心、黄永久：《夏县禹王城庙后辛庄战国手工业作坊遗址调查简报》，《文物季刊》1993年第2期。',
        citation_en:
          'Zhang Tongxin and Huang Yongjiu, "Survey of the Warring States Craft Workshop Site at Miaohouzhuang, Yuwang City, Xia County," Wenwu Jikan, no. 2 (1993).',
      },
    ],
    images: [
      {
        src: '/images/mints/anyi-plan.png',
        caption: 'Plan of the ancient city of Anyi (Yuwang City, 禹王城)',
        credit: 'After Tao and Ye 1962',
      },
    ],
  },
  {
    mint_code: 'jinyang',
    name_zh: '晋阳',
    name_en: 'Jinyang',
    state_zh: '赵',
    state_en: 'Zhao',
    modern_location_en: 'Taiyuan, Shanxi',
    lat: 37.8706,
    lng: 112.5489,
    description_en:
      'Jinyang served as the early capital of the Zhao state before its relocation to Handan. Square-foot spade coins and knife coins bearing the name of the city have been attributed to mints operating here during the Warring States period.',
    coin_types: ['Square-foot spades', 'Knife coins'],
    references: [],
  },
  {
    mint_code: 'handan',
    name_zh: '邯郸',
    name_en: 'Handan',
    state_zh: '赵',
    state_en: 'Zhao',
    modern_location_en: 'Handan, Hebei',
    lat: 36.6018,
    lng: 114.4927,
    description_en:
      'Capital of the Zhao state from the 4th century BCE. A major numismatic centre producing square-foot spade coins and knife coins. The site of the ancient city has been identified and partially excavated in modern Handan.',
    coin_types: ['Square-foot spades', 'Knife coins'],
    references: [],
  },
  {
    mint_code: 'pingyang',
    name_zh: '平阳',
    name_en: 'Pingyang',
    state_zh: '魏',
    state_en: 'Wei',
    modern_location_en: 'Linfen, Shanxi',
    lat: 36.0881,
    lng: 111.5189,
    description_en:
      'An important city in the Wei state during the Warring States period. Spade coins inscribed with the name Pingyang are among the most commonly found in the region.',
    coin_types: ['Square-foot spades'],
    references: [],
  },
  {
    mint_code: 'xiangping',
    name_zh: '襄平',
    name_en: 'Xiangping',
    state_zh: '燕',
    state_en: 'Yan',
    modern_location_en: 'Liaoyang, Liaoning',
    lat: 41.2689,
    lng: 123.1729,
    description_en:
      'The eastern capital and administrative centre of the Yan state. Knife coins attributed to Xiangping have been found across the northeastern regions of the Yan territory.',
    coin_types: ['Knife coins (Ming knife)'],
    references: [],
  },
  {
    mint_code: 'lingshou',
    name_zh: '灵寿',
    name_en: 'Lingshou',
    state_zh: '中山',
    state_en: 'Zhongshan',
    modern_location_en: 'Lingshou County, Shijiazhuang, Hebei',
    lat: 38.3082,
    lng: 114.3829,
    description_en:
      'Capital of the state of Zhongshan. Archaeological work at the site has revealed rich remains of the Warring States period. Round coins inscribed "Chengbai" have been associated with the mint at Lingshou.',
    coin_types: ['Round coins (Chengbai)'],
    references: [],
  },
  {
    mint_code: 'wuan',
    name_zh: '武安',
    name_en: "Wu'an",
    state_zh: '赵',
    state_en: 'Zhao',
    modern_location_en: "Wu'an, Handan, Hebei",
    lat: 36.6961,
    lng: 114.2041,
    description_en:
      "Wu'an was a strategically important city of the Zhao state. Square-foot spade coins bearing its name circulated widely in the Zhao territory.",
    coin_types: ['Square-foot spades'],
    references: [],
  },
]

export function getMintByCode(code: string): MintTown | undefined {
  return MINT_TOWNS.find((m) => m.mint_code === code)
}

export function searchMints(query: string): MintTown[] {
  const q = query.trim().toLowerCase()
  if (!q) return MINT_TOWNS
  return MINT_TOWNS.filter(
    (m) =>
      m.name_en.toLowerCase().includes(q) ||
      m.name_zh.includes(q) ||
      m.state_en.toLowerCase().includes(q) ||
      m.state_zh.includes(q) ||
      m.modern_location_en.toLowerCase().includes(q) ||
      m.coin_types.some((t) => t.toLowerCase().includes(q))
  )
}
