// Sequential "heat" ramp — light yellow -> orange -> red, validated with the
// dataviz palette checker (lightness-monotone, adjacent gaps, light-end
// contrast all pass). This is a deliberate multi-hue ramp (the classic
// ColorBrewer-style YlOrRd heat scale), not the tool's default single-hue
// rule — requested explicitly, and CVD separation from the other status
// colors below was checked with --pairs all.
const RAMP_LIGHT: [number, number, number] = [0xd9, 0xa4, 0x06] // low ratio: yellow
const RAMP_DARK: [number, number, number] = [0xa0, 0x15, 0x15] // high ratio: red

// Site/context has no record of the selected type at all. Very faint so it
// recedes behind real data.
export const NO_DATA_COLOR = '#c5c5c5'
export const NO_DATA_ALPHA = 0.18

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
