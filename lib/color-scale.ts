// Sequential "heat" ramp — light yellow -> orange -> red, validated with the
// dataviz palette checker (lightness-monotone, adjacent gaps, light-end
// contrast all pass). This is a deliberate multi-hue ramp (the classic
// ColorBrewer-style YlOrRd heat scale), not the tool's default single-hue
// rule — requested explicitly, and CVD separation from the other status
// colors below was checked with --pairs all.
const RAMP_LIGHT: [number, number, number] = [0xd9, 0xa4, 0x06] // low ratio: yellow
const RAMP_DARK: [number, number, number] = [0xa0, 0x15, 0x15] // high ratio: red

// Site has no record of the selected type at all. Rendered at low opacity
// (see NO_DATA_ALPHA) so it recedes rather than competing with real data.
export const NO_DATA_COLOR = '#b0b8b8'
export const NO_DATA_ALPHA = 0.2

// Reserved status-like colors, validated for CVD separation (worst all-pairs
// ΔE ~16, above the 12 target) from the ramp and from each other.
export const PRESENT_UNQUANTIFIED_COLOR = '#FF66C4' // pink
export const ONE_OF_ONE_COLOR = '#aa00ff'           // magenta

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

export const RAMP_LEGEND_STOPS = [
  { ratio: 0.00, color: '#8B0000' },
  { ratio: 0.10, color: '#B3001B' },
  { ratio: 0.25, color: '#D7191C' },
  { ratio: 0.40, color: '#F03B20' },
  { ratio: 0.55, color: '#FD6A02' },
  { ratio: 0.70, color: '#FF8C00' },
  { ratio: 0.85, color: '#FFB000' },
  { ratio: 1.00, color: '#FFF200' },
]
