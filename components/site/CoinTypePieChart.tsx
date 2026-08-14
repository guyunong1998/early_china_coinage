'use client'

import { useState } from 'react'
import { colorForType, shadesOf } from '@/lib/coin-type-colors'

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

// Math.cos/Math.sin can differ in their last bit between the server's V8
// and the browser's — same JS, different machine — which turned into a
// hydration mismatch: the `d` attribute's server- and client-rendered
// strings disagreed at the ~13th significant digit. Rounding collapses
// that noise below the threshold that would ever show up as a different
// string, and three decimal places is already far finer than this chart
// ever renders at (max size ~150px).
function round(n: number) {
  return Math.round(n * 1000) / 1000
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) }
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
export function CoinTypePieChart({
  data,
  size = 150,
  showLegend = true,
}: {
  data: PieGroup[]
  size?: number
  showLegend?: boolean
}) {
  // Row budget for the legend: a type with a single inscription folds into
  // one row, so only types with >1 inscription contribute extra rows beyond
  // their own. Within budget, inscriptions default open; over budget, they
  // default closed (behind the toggle) so the legend doesn't sprawl — types
  // themselves are never hidden or capped either way.
  const totalRows = data.length + data.reduce((sum, g) => sum + (g.children.length > 1 ? g.children.length : 0), 0)
  const defaultExpanded = totalRows <= 10

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() =>
    defaultExpanded ? new Set(data.filter((g) => g.children.length > 1).map((g) => g.label)) : new Set()
  )

  function toggleType(label: string) {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) return null

  const rOuter = size / 2
  const rMid = rOuter * 0.62
  const cx = rOuter
  const cy = rOuter

  const { groups } = data.reduce<{ cursor: number; groups: RenderGroup[] }>(
    (acc, g) => {
      const startAngle = acc.cursor
      const endAngle = acc.cursor + (g.value / total) * 360
      const baseColor = colorForType(g.label)

      const childTotal = g.children.reduce((sum, c) => sum + c.value, 0) || g.value
      const shades = shadesOf(baseColor, Math.max(g.children.length, 1))
      const childSource =
        g.children.length > 0 ? g.children : [{ label: g.label, labelEn: g.labelEn, value: g.value }]
      const { children } = childSource.reduce<{ cursor: number; children: RenderChild[] }>(
        (childAcc, c, j) => {
          const childStart = childAcc.cursor
          const childEnd = childAcc.cursor + (c.value / childTotal) * (endAngle - startAngle)
          return {
            cursor: childEnd,
            children: [
              ...childAcc.children,
              { ...c, color: shades[j % shades.length], startAngle: childStart, endAngle: childEnd },
            ],
          }
        },
        { cursor: startAngle, children: [] }
      )

      return {
        cursor: endAngle,
        groups: [
          ...acc.groups,
          { label: g.label, labelEn: g.labelEn, value: g.value, color: baseColor, startAngle, endAngle, children },
        ],
      }
    },
    { cursor: 0, groups: [] }
  )

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
            <title>{`${g.label}: ${g.value} (${Math.round((g.value / total) * 100)}%)`}</title>
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
              <title>{`${g.label} · ${c.label}: ${c.value} (${Math.round((c.value / total) * 100)}%)`}</title>
            </path>
          ))
        )}
      </svg>

      {showLegend && (
      <ul className="min-w-[220px] flex-1 space-y-1.5 text-xs">
        {groups.map((g) => {
          const hasInscriptions = g.children.length > 1
          const isExpanded = expandedTypes.has(g.label)
          return (
          <li key={g.label}>
            <div
              className={`flex items-start justify-between gap-2 font-semibold ${
                hasInscriptions ? 'cursor-pointer select-none hover:text-brand' : ''
              }`}
              role={hasInscriptions ? 'button' : undefined}
              tabIndex={hasInscriptions ? 0 : undefined}
              aria-expanded={hasInscriptions ? isExpanded : undefined}
              onClick={hasInscriptions ? () => toggleType(g.label) : undefined}
              onKeyDown={
                hasInscriptions
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleType(g.label)
                      }
                    }
                  : undefined
              }
            >
              <span className="flex items-start gap-1.5">
                <span
                  className={`mt-0.5 w-3 shrink-0 text-center text-[9px] text-gray-400 transition-transform ${
                    hasInscriptions ? '' : 'invisible'
                  } ${isExpanded ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                >
                  ▶
                </span>
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
            {hasInscriptions && isExpanded && (
              <ul className="ml-[34px] mt-0.5 space-y-0.5">
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
          )
        })}
      </ul>
      )}
    </div>
  )
}
