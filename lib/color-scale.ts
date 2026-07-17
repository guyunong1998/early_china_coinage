// Sequential "heat" ramp — light yellow -> orange -> red, validated with the
// dataviz palette checker (lightness-monotone, adjacent gaps, light-end
// contrast all pass). This is a deliberate multi-hue ramp (the classic
// ColorBrewer-style YlOrRd heat scale), not the tool's default single-hue
// rule — requested explicitly, and CVD separation from the other status
// colors below was checked with --pairs all.
const RAMP_LIGHT: [number, number, number] = [0xd9, 0xa4, 0x06] // low ratio: yellow
const RAMP_DARK: [number, number, number] = [0xa0, 0x15, 0x15] // high ratio: red

// Site/context has no record of the selected type at all. A darker, fixed
// gray (paired with a smaller, fixed dot size at the call sites) so it reads
// unambiguously as "nothing here" rather than a faint step of the ratio
// scale. Keep in sync with app/maps.css's --map-dot-nodata-fill, which the
// actual marker uses (this constant backs the legend swatch and popup bar,
// which can't read a CSS custom property).
export const NO_DATA_COLOR = '#5a5a5a'
export const NO_DATA_ALPHA = 0.55

// Type is present in a context but quantities cannot be computed — full
// opacity so it doesn't read as "less certain" than quantified sites.
export const PRESENT_UNQUANTIFIED_COLOR = '#9caa4a'

// The site's only recorded coin (total quantity across all types = 1) is the
// selected type — distinct from a large site that merely happens to be 100%
// one type, which is a much less notable pattern.
export const SINGLE_FIND_COLOR = '#7b3fa0'

// Legacy alias kept for older heatmap UI bits.
export const ONE_OF_ONE_COLOR = SINGLE_FIND_COLOR

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function toHex(channels: [number, number, number]) {
  return '#' + channels.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function hexToRgba(hex: string, alpha: number) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** ratio in [0, 1]; 0 quantity should use NO_DATA_COLOR instead of this scale. */
export function ratioToColor(ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio))
  return toHex([
    lerp(RAMP_LIGHT[0], RAMP_DARK[0], t),
    lerp(RAMP_LIGHT[1], RAMP_DARK[1], t),
    lerp(RAMP_LIGHT[2], RAMP_DARK[2], t),
  ])
}

/** Legend stops matching ratioToColor (low % = yellow, high % = red). */
export const RAMP_LEGEND_STOPS = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
  ratio,
  color: ratioToColor(ratio),
}))

// Shared leaflet.heat gradient (light yellow -> red) used by every density
// heat layer in the app (MapVisCanvas.tsx's density view mode, and the
// homepage CoinFilterMap's always-on density layer) — one definition so
// retinting/opacity changes apply everywhere at once.
const DENSITY_GRADIENT_STOPS: [number, string][] = [
  [0.15, '#f0d56a'],
  [0.4, '#e39a2b'],
  [0.65, '#d04a1c'],
  [0.85, '#a01515'],
  [1, '#6e0c0c'],
]

/** Reads app/maps.css's `--heatmap-opacity` (single source of truth) so the
 * gradient stops below can bake it into each color — leaflet.heat has no
 * single "layer opacity" option that applies evenly across the ramp. */
export function readHeatmapOpacity(): number {
  if (typeof document === 'undefined') return 0.5
  const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--heatmap-opacity'))
  return Number.isFinite(raw) ? raw : 0.5
}

export function buildDensityGradient(opacity: number): Record<number, string> {
  const gradient: Record<number, string> = {}
  DENSITY_GRADIENT_STOPS.forEach(([stop, hex]) => {
    gradient[stop] = hexToRgba(hex, opacity)
  })
  return gradient
}
