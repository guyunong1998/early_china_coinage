// Plain module (no 'use client') so both server components (e.g.
// app/search/page.tsx's color swatches) and client components (the
// CoinTypePieChart itself) can call colorForType and get the exact same
// answer — a 'use client' module's exports can only be rendered as a
// component or passed as props, never called directly from server code.

const PALETTE = [
  '#006d71', // brand teal
  '#c0392b', // terracotta red
  '#d4a017', // ochre
  '#4a7c59', // olive green
  '#7c5295', // plum
  '#2f7fbf', // slate blue
  '#a0522d', // sienna
  '#8b8b3d', // bronze-green
]

/**
 * Permanent color per level2 type, so a slice's color is a property of the
 * type itself rather than of where it lands in a particular card's data
 * (the old `PALETTE[i % PALETTE.length]` scheme reassigned colors every
 * time the set of types present, or their order, changed). Every mould
 * label (level2_zh ending in 范) shares its coin counterpart's hue one
 * shade lighter — a spade coin and the mould that cast it are the same
 * real-world type, not unrelated categories, so they read as a family.
 */
const TYPE_COLORS: Record<string, string> = {
  布币: '#006d71', // spade coin — brand teal
  布币范: '#5aa9ac', // spade coin mould
  刀币: '#c0392b', // knife coin — terracotta red
  刀币范: '#dd8a7f', // knife coin mould
  圜钱: '#d4a017', // round coin — ochre
  圜钱范: '#e8c467', // round coin mould
  蚁鼻钱: '#7c5295', // cowrie coin — plum
  蚁鼻钱范: '#b696cb', // cowrie coin mould
  金版: '#2f7fbf', // gold plate — slate blue
  金饼: '#a0522d', // gold cake — sienna
  马蹄金: '#4a7c59', // horse-hoof gold — olive green
  钱范: '#8b8b3d', // coin mould (collapsed, no per-type breakdown) — bronze-green
}

/** Every literal fallback label callers use for a find with no resolved
 * coin type — '未知' (site-card pies, app/search/page.tsx's buildSitePie)
 * and 'Unclassified' (context pies, SiteDetailTabs.tsx) both mean the same
 * "no data" bucket and must read as the same neutral gray, not two
 * different hash-derived hues. */
const UNCLASSIFIED_LABELS = new Set(['未知', 'Unclassified', '未分类'])
const UNCLASSIFIED_COLOR = '#9ca3af' // neutral gray, distinct from every hue in TYPE_COLORS/PALETTE

/** Deterministic string hash, so a type absent from TYPE_COLORS (a new
 *  hierarchy entry not yet listed above) still always renders the same
 *  fallback color instead of one that drifts with array order. */
function hashString(s: string) {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return hash
}

/** The color a type label gets in CoinTypePieChart — exported so callers
 * rendering a type label outside the chart itself (e.g. the search results
 * list's color swatches) can match the exact slice color it'd get inside
 * the chart. */
export function colorForType(label: string): string {
  if (UNCLASSIFIED_LABELS.has(label)) return UNCLASSIFIED_COLOR
  return TYPE_COLORS[label] ?? PALETTE[hashString(label) % PALETTE.length]
}

function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number) {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Generates `count` shades of a base color, spread across a lightness band
 * anchored to the base color's own lightness (not a fixed band) — a fixed
 * 32–78 band read fine against a mid-tone base but, against a dark base like
 * spade coin's teal (~22 lightness), put the single-child case at 48 and the
 * multi-child case as high as 78: a near-pastel shade sitting right next to
 * the deep inner wedge, reading as an unrelated color rather than a shade of
 * it. Staying within a modest step of the base keeps every shade legible as
 * "the same hue, lighter" regardless of how dark or light that hue starts. */
export function shadesOf(baseHex: string, count: number) {
  const { h, s, l } = hexToHsl(baseHex)
  if (count <= 1) return [hslToHex(h, s, Math.min(l + 12, 85))]
  const minL = Math.max(l - 10, 15)
  const maxL = Math.min(l + 14, 85)
  return Array.from({ length: count }, (_, i) => hslToHex(h, s, minL + (i / (count - 1)) * (maxL - minL)))
}
