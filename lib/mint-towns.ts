import { MINT_DOSSIERS, type MintDossier } from '@/lib/mint-dossiers'

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
  /** null/undefined when the source document does not give a specific geolocation */
  lat?: number | null
  lng?: number | null
  description_en: string
  coin_types: string[]
  references: MintReference[]
  images?: MintImage[]
}

// ── Hand-curated overrides layered on top of the auto-generated dossier data ──
// Use this for polished bilingual citations and images. Anything not listed
// here falls back to values derived automatically from lib/mint-dossiers.ts.
type MintOverride = Partial<MintTown>

const MINT_OVERRIDES: Record<string, MintOverride> = {
  anyi: {
    modern_location_en: 'Xia County, Yuncheng, Shanxi',
    references: [
      {
        citation_zh: '陶正刚、叶学明：《古魏城和禹王古城调查简报》，《考古》1962年第1期。',
        citation_en:
          'Tao Zhenggang and Ye Xueming, "Survey Report on the Ancient Wei City and Yuwang City," Kaogu, no. 1 (1962).',
      },
      {
        citation_zh: '张童心、黄永久：《夏县禹王城庙后辛庄战国手工业作坊遗址调查简报》，《文物季刊》1993年第2期。',
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
}

// ── Mints that exist only as hand-curated entries (no docx dossier match) ──
const STANDALONE_MINT_TOWNS: MintTown[] = [
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
]

// ── English romanisation for mints not already spelled out in the dossier text ──
const NAME_EN: Record<string, string> = {
  anyi: 'Anyi', wei: 'Wei', yinjin: 'Yinjin', puban: 'Puban', gaonu: 'Gaonu',
  yanyang: 'Yanyang', shan: 'Shan', shaoliang: 'Shaoliang', lushi: 'Lushi', gong: 'Gong',
  anyin: 'Anyin', xuanshi: 'Xuanshi',
  xidu: 'Xidu', pingzhou: 'Pingzhou', yangqu: 'Yangqu', jinyang: 'Jinyang', yuji: 'Yuji',
  zishi: 'Zishi', lin: 'Lin', xiangcheng: 'Xiangcheng', handan: 'Handan', dayin: 'Da Yin',
  yangyi: 'Yangyi', lvsi: 'Lvsi', lie: 'Lie', zhongyang: 'Zhongyang', wuan: "Wu'an",
  wuping: 'Wuping', lishi: 'Lishi', xincheng: 'Xincheng', yu: 'Yu', huoren: 'Huoren',
  wenyang: 'Wenyang', shouyin: 'Shouyin', pingtao: 'Pingtao',
  nie: 'Nie', changzi: 'Changzi', xiangyuan: 'Xiangyuan', lu: 'Lu', zhongdu: 'Zhongdu',
  pingyang: 'Pingyang', anyang: 'Anyang', dai: 'Dai', tujun: 'Tujun', pingyin: 'Pingyin',
  pingshu: 'Pingshu', wuxian: 'Wu (邬)', beiqu: 'Beiqu', yiyang: 'Yiyang', xicheng: 'Xicheng',
  zhaiyang: 'Zhaiyang', tunliu: 'Tunliu', tongshi: 'Tongshi', pishi: 'Pishi', suanzao: 'Suanzao',
  qishi: 'Qishi', puzi: 'Puzi', daliang: 'Daliang', gaodu: 'Gaodu', yuyang: 'Yuyang',
  zhi: 'Zhi',
  dongzhou: 'Dongzhou', guanyang: 'Guanyang', beixun: 'Beixun',
  yanduxia: 'Yandu Xia', hangao: 'Hangao', xiangping: 'Xiangping', guangchang: 'Guangchang',
  chongping: 'Chongping',
}

// ── Best-effort modern location, paraphrased from the description text in the
// same dossier entry (province/county names explicitly stated in the source). ──
const MODERN_LOCATION: Record<string, string> = {
  anyi: 'Xia County, Yuncheng, Shanxi', wei: 'Ruicheng County, Yuncheng, Shanxi',
  yinjin: 'Huayin, Weinan, Shaanxi', puban: 'Yongji (Puzhou), Shanxi',
  gaonu: "Yan'an area, Shaanxi", yanyang: 'Suide County, Shaanxi',
  shan: 'Shanzhou District, Sanmenxia, Henan', shaoliang: 'Hancheng, Weinan, Shaanxi',
  lushi: 'Lushi County, Sanmenxia, Henan', gong: 'Huixian, Xinxiang, Henan',
  anyin: 'Unknown', xuanshi: 'Gaoping, Jincheng, Shanxi',
  xidu: 'Yulin area, Shaanxi', pingzhou: 'Mizhi County, Yulin, Shaanxi',
  yangqu: 'Dingxiang County, Xinzhou, Shanxi', jinyang: 'Taiyuan, Shanxi',
  yuji: 'Yuci District, Jinzhong, Shanxi', zishi: 'Fenyang, Lvliang, Shanxi',
  lin: 'Lishi District, Lvliang, Shanxi', xiangcheng: 'Yulin area, Shaanxi (approximate)',
  handan: 'Handan, Hebei', dayin: 'Huo County, Linfen, Shanxi',
  yangyi: 'Taigu County, Jinzhong, Shanxi', lvsi: 'Wutai County, Xinzhou, Shanxi',
  lie: 'Wuzhai County, Xinzhou, Shanxi', zhongyang: 'Shenmu / Fugu area, Yulin, Shaanxi',
  wuan: "Wu'an, Handan, Hebei", wuping: 'Zhang River valley, Hebei (approximate)',
  lishi: 'Lishi District, Lvliang, Shanxi', xincheng: 'Shuo County, Shanxi',
  yu: 'Yangqu County, Taiyuan, Shanxi', huoren: 'Fanshi County, Xinzhou, Shanxi',
  wenyang: 'Wenshui County, Lvliang, Shanxi (provisional, Zhu Hua)',
  shouyin: 'Shouyang County, Jinzhong, Shanxi (provisional, Zhu Hua)',
  pingtao: 'Wenshui County, Lvliang, Shanxi',
  nie: 'Wuxiang County, Changzhi, Shanxi', changzi: 'Changzi County, Changzhi, Shanxi',
  xiangyuan: 'Xiangyuan County, Changzhi, Shanxi', lu: 'Lucheng District, Changzhi, Shanxi',
  zhongdu: 'Pingyao County, Jinzhong, Shanxi', pingyang: 'Xiangfen, Linfen, Shanxi',
  anyang: 'Hohhot area, Inner Mongolia (multiple candidate sites)',
  dai: 'Yu County (Daiwangcheng), Zhangjiakou, Hebei', tujun: 'Shilou County, Lvliang, Shanxi',
  pingyin: 'Yanggao County, Datong, Shanxi', pingshu: 'Guangling County, Datong, Shanxi',
  wuxian: 'Jiexiu, Jinzhong, Shanxi', beiqu: 'Ji County, Linfen, Shanxi',
  yiyang: 'Yiyang County, Luoyang, Henan', xicheng: 'Lishi District, Lvliang, Shanxi',
  zhaiyang: 'Xingyang, Zhengzhou, Henan', tunliu: 'Tunliu County, Changzhi, Shanxi',
  tongshi: 'Qin County, Changzhi, Shanxi', pishi: 'Hejin, Yuncheng, Shanxi',
  zhi: 'Huozhou, Linfen, Shanxi',
  suanzao: 'Yanjin County, Xinxiang, Henan', qishi: 'Linyi County, Yuncheng, Shanxi',
  puzi: 'Xi County, Lvliang, Shanxi', daliang: 'Kaifeng, Henan',
  gaodu: 'Zezhou County, Jincheng, Shanxi', yuyang: 'Pinglu County, Yuncheng, Shanxi',
  dongzhou: 'Gongyi, Zhengzhou, Henan', guanyang: 'Hohhot area, Inner Mongolia',
  beixun: 'Gongyi area, Henan (approximate)',
  yanduxia: 'Yi County, Baoding, Hebei', hangao: 'Beijing area (approximate)',
  xiangping: 'Liaoyang, Liaoning', guangchang: 'Laishui area, Hebei (approximate)',
  chongping: 'Cangzhou area, Hebei (approximate)',
}

// ── State attribution: category default, overridden per mint where the
// document explicitly names the issuing state. ──
const STATE_OVERRIDES: Record<string, { zh: string; en: string }> = {
  gaodu: { zh: '魏', en: 'Wei' },
  dongzhou: { zh: '东周', en: 'Eastern Zhou' },
  dai: { zh: '赵', en: 'Zhao' },
  pingyang: { zh: '韩', en: 'Han' },
  yiyang: { zh: '韩', en: 'Han' },
  suanzao: { zh: '魏', en: 'Wei' },
  daliang: { zh: '魏', en: 'Wei' },
  yanduxia: { zh: '燕', en: 'Yan' },
  hangao: { zh: '燕', en: 'Yan' },
  xiangping: { zh: '燕', en: 'Yan' },
  guangchang: { zh: '燕', en: 'Yan' },
  chongping: { zh: '燕', en: 'Yan' },
}

function defaultState(coinTypes: string[]): { zh: string; en: string } {
  if (coinTypes.includes('Bridge-foot spades')) return { zh: '魏', en: 'Wei' }
  if (coinTypes.includes('Pointed-foot spades')) return { zh: '赵', en: 'Zhao' }
  if (coinTypes.includes('Square-foot spades')) return { zh: '三晋', en: 'Jin States (Han/Zhao/Wei)' }
  return { zh: '未知', en: 'Unknown' }
}

function parseGeolocation(raw?: string): { lat: number | null; lng: number | null } {
  if (!raw) return { lat: null, lng: null }
  const match = raw.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/)
  if (!match) return { lat: null, lng: null }
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
}

function dossierToMintTown(dossier: MintDossier): MintTown {
  const override = MINT_OVERRIDES[dossier.mint_code] ?? {}
  const coinTypes = dossier.coin_types ?? []
  const state = STATE_OVERRIDES[dossier.mint_code] ?? defaultState(coinTypes)
  const { lat, lng } = parseGeolocation(dossier.geolocation)

  return {
    mint_code: dossier.mint_code,
    name_zh: dossier.name_zh_doc ?? dossier.mint_code,
    name_en: NAME_EN[dossier.mint_code] ?? dossier.mint_code,
    state_zh: state.zh,
    state_en: state.en,
    modern_location_en: MODERN_LOCATION[dossier.mint_code] ?? 'See description',
    lat,
    lng,
    description_en: dossier.description_en ?? '',
    coin_types: coinTypes,
    references: (dossier.references ?? []).map((r) => ({ citation_zh: r })),
    ...override,
  }
}

export const MINT_TOWNS: MintTown[] = [
  ...MINT_DOSSIERS.map(dossierToMintTown),
  ...STANDALONE_MINT_TOWNS,
]

export function getMintByCode(code: string): MintTown | undefined {
  return MINT_TOWNS.find((m) => m.mint_code === code)
}

/**
 * Alternate mint names appearing on coins or in the database that refer to
 * the same mint town as the canonical dossier name (name_zh).
 */
const MINT_NAME_ALIASES: Record<string, string> = {
  阴: '大阴',
  平州: '平周',
  邯郸: '甘丹',
  阳化: '阳曲',
  彘邑: '彘',
  藿人: '霍人',
  土匀: '土军',
}

/** Map a coin/database mint label to the canonical dossier Chinese name. */
export function resolveMintNameZh(nameZh: string): string {
  const trimmed = nameZh.trim()
  if (!trimmed) return trimmed
  return MINT_NAME_ALIASES[trimmed] ?? trimmed
}

/** All Chinese labels that refer to the same mint (DB + dossier aliases). */
export function getMintNameVariants(nameZh: string): string[] {
  const trimmed = nameZh.trim()
  if (!trimmed) return []
  const canonical = resolveMintNameZh(trimmed)
  const variants = new Set<string>([trimmed, canonical])
  for (const [alias, canon] of Object.entries(MINT_NAME_ALIASES)) {
    if (canon === canonical || alias === trimmed || alias === canonical || canon === trimmed) {
      variants.add(alias)
      variants.add(canon)
    }
  }
  return [...variants]
}

/** Look up a mint town by its Chinese name (as stored in coin_types.mint_zh). */
export function getMintByNameZh(nameZh: string): MintTown | undefined {
  const trimmed = nameZh.trim()
  if (!trimmed) return undefined
  const canonical = resolveMintNameZh(trimmed)
  return MINT_TOWNS.find((m) => m.name_zh === canonical)
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
