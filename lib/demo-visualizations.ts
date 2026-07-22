import { emptyTypologySelection, type TypologyFilterSelection } from '@/lib/typology-filter'
import { encodeMintNames, encodeTypologySelections } from '@/lib/visualization-deeplink'
import type { FilterMode, ViewMode } from '@/lib/context-heatmap'

/**
 * The homepage's "demo" carousel — a handful of hand-picked, pre-built
 * filter states linking into Map Visualizations / Museum Collections, each
 * shown as a card (screenshot + description). This is the one file to edit
 * to add, remove, or change a demo: everything else (the URL, the seeded
 * filter state on the target page) is derived from the plain fields below
 * by demoHref() and lib/visualization-deeplink.ts — never hand-write a URL.
 *
 * `mints`/`types` are always the human-readable zh names/labels (a mint's
 * own name_zh, a coin type's level1..level5 label) — never a database id,
 * since ids like coin_issues.mint_id aren't stable enough to hardcode here
 * and wouldn't mean anything to someone editing this list later. The target
 * page resolves each name back to whatever internal id it needs at render
 * time (see FindSpotsVisualization's `initialMintNames` handling).
 *
 * After adding or changing a demo, regenerate its screenshot:
 *   node scripts/capture-demo-screenshots.mjs [demo-id]
 * ...or, if you're dropping in a screenshot of your own instead, save it to
 * `image` above and then crop it to the carousel's fixed 16:9 frame:
 *   node scripts/crop-demo-images.mjs [filename]
 */

/** Shorthand for a coin-type selection — omit trailing levels you don't
 * need (e.g. `typeSel('钱币', '布币')` for "any spade coin"). */
function typeSel(level1: string, level2 = '', level3 = '', level4 = '', level5 = ''): TypologyFilterSelection {
  return { ...emptyTypologySelection(), level1, level2, level3, level4, level5 }
}

type DemoTarget =
  | { page: 'find-site'; mode: Extract<FilterMode, 'mint'>; view: ViewMode; mints: string[] }
  | { page: 'find-site'; mode: Extract<FilterMode, 'type'>; view: ViewMode; types: TypologyFilterSelection[] }
  | { page: 'mint-town'; view: ViewMode; types: TypologyFilterSelection[] }
  | { page: 'museum-collections'; view: ViewMode; types: TypologyFilterSelection[] }

export type DemoVisualization = {
  id: string
  title: { zh: string; en: string }
  /** What the view shows, one full sentence — rendered under `title`/`via`
   * and clamped to a fixed number of lines (see DemoVisualizationsCarousel.tsx)
   * so the panel's height never changes switching slides. */
  description: { zh: string; en: string }
  /** How to get there (filter mode + display mode), rendered in parens
   * after `description` — e.g. "Mint Town view, Points display". */
  via: { zh: string; en: string }
  /** Static screenshot at public/images/home-demos/<id>.png. */
  image: string
  target: DemoTarget
}

export const DEMO_VISUALIZATIONS: DemoVisualization[] = [
  {
    id: 'spade-knife-round-compare',
    title: { zh: '布币、刀币、圜钱对比', en: 'Spade, knife & round coins compared' },
    description: {
      zh: '对比布币、刀币、圜钱三大币种在各出土遗址中的分布情况',
      en: 'Compares spade, knife, and round coin distributions across every recorded find site',
    },
    via: {
      zh: '按币种，对比视图',
      en: 'Coin Type, Compare view',
    },
    image: '/images/home-demos/spade-knife-round-compare.png',
    target: {
      page: 'find-site',
      mode: 'type',
      view: 'compare',
      types: [typeSel('钱币', '布币'), typeSel('钱币', '刀币'), typeSel('钱币', '圜钱')],
    },
  },
  {
    id: 'mint-compare-anyang-anyi',
    title: { zh: '安阳与安邑铸地对比', en: 'Anyang vs. Anyi mints' },
    description: {
      zh: '对比安阳与安邑两处铸地的铸币产量与出土遗址分布',
      en: 'Compares coin output and find-site reach between the Anyang and Anyi mints',
    },
    via: {
      zh: '按铸地，对比视图',
      en: 'Mint, Compare view',
    },
    image: '/images/home-demos/mint-compare-anyang-anyi.png',
    target: { page: 'find-site', mode: 'mint', view: 'compare', mints: ['安阳', '安邑'] },
  },
  {
    id: 'knife-density',
    title: { zh: '刀币分布密度', en: 'Knife coin density' },
    description: {
      zh: '以密度热力图展示刀币出土最为集中的区域',
      en: 'A density heatmap showing where knife coin finds concentrate most heavily',
    },
    via: {
      zh: '按币种，密度视图',
      en: 'Coin Type, Density view',
    },
    image: '/images/home-demos/knife-density.png',
    target: { page: 'find-site', mode: 'type', view: 'density', types: [typeSel('钱币', '刀币')] },
  },
  {
    id: 'spade-mint-towns',
    title: { zh: '布币铸地', en: 'Spade coin mint towns' },
    description: {
      zh: '按铸币产量显示每一处铸造布币的城邑',
      en: 'Every mint town that produced spade coins, sized by its recorded output',
    },
    via: {
      zh: '铸地视图，点状显示',
      en: 'Mint Town, Points view',
    },
    image: '/images/home-demos/spade-mint-towns.png',
    target: { page: 'mint-town', view: 'points', types: [typeSel('钱币', '布币')] },
  },
  {
    id: 'museum-fangzubu-jianzubu',
    title: { zh: '方足布与尖足布馆藏对比', en: 'Square-foot vs. pointed-foot spades' },
    description: {
      zh: '对比方足布与尖足布两类布币在 ANS 博物馆藏品中的分布',
      en: 'Compares ANS museum specimens of square-foot and pointed-foot spade coins',
    },
    via: {
      zh: '博物馆，对比',
      en: 'Museum, Compare view',
    },
    image: '/images/home-demos/museum-fangzubu-jianzubu.png',
    target: {
      page: 'museum-collections',
      view: 'compare',
      types: [typeSel('钱币', '布币', '平首布', '方足布'), typeSel('钱币', '布币', '平首布', '尖足布')],
    },
  },
]

const TARGET_PATH: Record<DemoTarget['page'], string> = {
  'find-site': '/visualizations/find-site',
  'mint-town': '/visualizations/mint-town',
  'museum-collections': '/museum-collections',
}

/** Builds the pre-built query-string link for a demo — the one place that
 * knows how DemoTarget maps to lib/visualization-deeplink.ts's params. */
export function demoHref(demo: DemoVisualization): string {
  const { target } = demo
  const params = new URLSearchParams()
  params.set('view', target.view)

  if (target.page === 'find-site') {
    params.set('mode', target.mode)
    if (target.mode === 'mint') {
      if (target.mints.length > 0) params.set('mints', encodeMintNames(target.mints))
    } else if (target.types.length > 0) {
      params.set('types', encodeTypologySelections(target.types))
    }
  } else if (target.types.length > 0) {
    params.set('types', encodeTypologySelections(target.types))
  }

  return `${TARGET_PATH[target.page]}?${params.toString()}`
}
