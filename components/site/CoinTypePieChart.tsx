export type PieChild = {
  label: string
  labelEn?: string | null
  value: number
}

export type PieGroup = {
  label: string
  labelEn?: string | null
  value: number
  children: PieChild[]
}

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

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Pie slice from the center out to radius r. */
function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx},${cy} L ${start.x},${start.y} A ${r},${r} 0 ${largeArc} 1 ${end.x},${end.y} Z`
}

/** Annular (donut) slice between rInner and rOuter. */
function describeRingSlice(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(cx, cy, rOuter, startAngle)
  const outerEnd = polarToCartesian(cx, cy, rOuter, endAngle)
  const innerEnd = polarToCartesian(cx, cy, rInner, endAngle)
  const innerStart = polarToCartesian(cx, cy, rInner, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x},${outerStart.y}`,
    `A ${rOuter},${rOuter} 0 ${largeArc} 1 ${outerEnd.x},${outerEnd.y}`,
    `L ${innerEnd.x},${innerEnd.y}`,
    `A ${rInner},${rInner} 0 ${largeArc} 0 ${innerStart.x},${innerStart.y}`,
    'Z',
  ].join(' ')
}

// Avoids a degenerate SVG arc (zero-length) when a slice spans the full circle.
function clampSpan(startAngle: number, endAngle: number) {
  return endAngle - startAngle >= 359.99 ? startAngle + 359.99 : endAngle
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

/** Generates `count` shades of a base color, spread across a lightness band, to keep child slices visually tied to their parent's hue. */
function shadesOf(baseHex: string, count: number) {
  const { h, s } = hexToHsl(baseHex)
  const minL = 32
  const maxL = 78
  if (count <= 1) return [hslToHex(h, s, 48)]
  return Array.from({ length: count }, (_, i) => hslToHex(h, s, minL + (i / (count - 1)) * (maxL - minL)))
}

type RenderChild = PieChild & { color: string; startAngle: number; endAngle: number }

type RenderGroup = {
  label: string
  labelEn?: string | null
  value: number
  color: string
  startAngle: number
  endAngle: number
  children: RenderChild[]
}

/**
 * A small dependency-free two-level "sunburst" chart: the inner ring shows
 * the coin type, the outer ring subdivides each type by inscription (shaded
 * with tints of the parent type's color).
 */
export function CoinTypePieChart({ data, size = 150 }: { data: PieGroup[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) return null

  const rOuter = size / 2
  const rMid = rOuter * 0.62
  const cx = rOuter
  const cy = rOuter

  let cursor = 0
  const groups: RenderGroup[] = data.map((g, i) => {
    const startAngle = cursor
    const endAngle = cursor + (g.value / total) * 360
    cursor = endAngle
    const baseColor = PALETTE[i % PALETTE.length]

    const childTotal = g.children.reduce((sum, c) => sum + c.value, 0) || g.value
    const shades = shadesOf(baseColor, Math.max(g.children.length, 1))
    let childCursor = startAngle
    const children = (g.children.length > 0 ? g.children : [{ label: g.label, labelEn: g.labelEn, value: g.value }]).map(
      (c, j) => {
        const childStart = childCursor
        const childEnd = childCursor + (c.value / childTotal) * (endAngle - startAngle)
        childCursor = childEnd
        return { ...c, color: shades[j % shades.length], startAngle: childStart, endAngle: childEnd }
      }
    )

    return {
      label: g.label,
      labelEn: g.labelEn,
      value: g.value,
      color: baseColor,
      startAngle,
      endAngle,
      children,
    }
  })

  return (
    <div className="flex flex-wrap items-start gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label="Coin type and inscription breakdown"
      >
        {groups.map((g) => (
          <path
            key={`type-${g.label}`}
            d={describeSlice(cx, cy, rMid, g.startAngle, clampSpan(g.startAngle, g.endAngle))}
            fill={g.color}
          >
            <title>
              {g.label}: {g.value} ({Math.round((g.value / total) * 100)}%)
            </title>
          </path>
        ))}
        {groups.flatMap((g) =>
          g.children.map((c) => (
            <path
              key={`insc-${g.label}-${c.label}`}
              d={describeRingSlice(cx, cy, rMid, rOuter, c.startAngle, clampSpan(c.startAngle, c.endAngle))}
              fill={c.color}
              stroke="white"
              strokeWidth={0.5}
            >
              <title>
                {g.label} · {c.label}: {c.value} ({Math.round((c.value / total) * 100)}%)
              </title>
            </path>
          ))
        )}
      </svg>

      <ul className="min-w-[180px] space-y-1.5 text-xs">
        {groups.map((g) => (
          <li key={g.label}>
            <div className="flex items-start justify-between gap-2 font-semibold">
              <span className="flex items-start gap-1.5">
                <span
                  className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: g.color }}
                />
                <span className="text-gray-800">
                  {g.label}
                  {g.labelEn && g.labelEn !== g.label && (
                    <span className="ml-1 italic font-normal text-gray-400">{g.labelEn}</span>
                  )}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-gray-500">
                {g.value} · {Math.round((g.value / total) * 100)}%
              </span>
            </div>
            {g.children.length > 1 && (
              <ul className="ml-4 mt-0.5 space-y-0.5">
                {g.children.map((c) => (
                  <li key={c.label} className="flex items-start justify-between gap-2 text-gray-600">
                    <span className="flex items-start gap-1.5">
                      <span
                        className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>
                        {c.label}
                        {c.labelEn && c.labelEn !== c.label && (
                          <span className="ml-1 italic text-gray-400">{c.labelEn}</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-400">
                      {c.value} · {Math.round((c.value / total) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
