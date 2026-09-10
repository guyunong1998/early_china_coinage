'use client'

import { useState } from 'react'
import { colorForType, shadesOf, UNCLASSIFIED_COLOR } from '@/lib/coin-type-colors'

export type PieChild = {
  label: string
  labelEn?: string | null
  value: number
}

/** A type/inscription combo recorded as present but never quantified, that
 * belongs under a quantified type's dropdown rather than standing on its
 * own — either the same type under a different inscription (no
 * `subtypeLabel`), or a subtype of it (`subtypeLabel` set). */
export type UnquantifiedChild = {
  subtypeLabel?: string
  subtypeLabelEn?: string | null
  inscriptionLabel: string
  inscriptionLabelEn?: string | null
  count: number
}

export type PieGroup = {
  label: string
  labelEn?: string | null
  value: number
  children: PieChild[]
  /** Unquantified type/inscription combos that are this type, or a subtype
   * of it — folded into this group's dropdown instead of the standalone
   * "unquantified types" list below. */
  unquantifiedChildren?: UnquantifiedChild[]
}

/** One type/inscription combo that was recorded as present but never got a
 * quantity, so it can't be a slice of the chart, and has no quantified type
 * of its own (or subtype relationship to one) to fold under — shown as its
 * own legend row instead (see the "unquantified types" row in the legend
 * below). */
export type UnquantifiedItem = {
  label: string
  labelEn?: string | null
  inscriptionLabel: string
  inscriptionLabelEn?: string | null
  count: number
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

/** Same footprint as a type row's colored square swatch, but a gray circle
 * with an exclamation mark (no type color of its own) — marks the
 * "unquantified types" legend row as a different kind of thing
 * (present-but-uncounted) rather than another color-coded slice. */
function UnquantifiedSwatch({ className = 'mt-0.5 h-2.5 w-2.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill={UNCLASSIFIED_COLOR} />
      <rect x="7.25" y="3.5" width="1.5" height="5.5" rx="0.75" fill="white" />
      <rect x="7.25" y="10.5" width="1.5" height="1.5" rx="0.75" fill="white" />
    </svg>
  )
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
  unquantifiedChildren: UnquantifiedChild[]
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
  unquantified = [],
}: {
  data: PieGroup[]
  size?: number
  showLegend?: boolean
  /** Types/inscriptions recorded as present but never quantified, so they
   * can't be drawn as slices — rendered as one extra legend row (a warning
   * triangle instead of a color swatch) that expands to list them. */
  unquantified?: UnquantifiedItem[]
}) {
  // Row budget for the legend: a type with a single inscription folds into
  // one row, so only types with >1 inscription contribute extra rows beyond
  // their own. Within budget, inscriptions default open; over budget, they
  // default closed (behind the toggle) so the legend doesn't sprawl — types
  // themselves are never hidden or capped either way.
  const dropdownRowCount = (g: PieGroup) =>
    (g.children.length > 1 ? g.children.length : 0) + (g.unquantifiedChildren?.length ?? 0)
  const hasDropdown = (g: PieGroup) => g.children.length > 1 || (g.unquantifiedChildren?.length ?? 0) > 0
  const totalRows = data.length + data.reduce((sum, g) => sum + dropdownRowCount(g), 0)
  const defaultExpanded = totalRows <= 10

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() =>
    defaultExpanded ? new Set(data.filter(hasDropdown).map((g) => g.label)) : new Set()
  )
  const [showUnquantified, setShowUnquantified] = useState(false)

  function toggleType(label: string) {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0 && unquantified.length === 0) return null

  const hasUnquantified =
    unquantified.length > 0 || data.some((g) => (g.unquantifiedChildren?.length ?? 0) > 0)
  // Reserve a band just outside the donut for the gray "unquantified types
  // exist" ring, so it reads as a third ring of the chart — flush against
  // the inscription ring rather than a halo floating outside it.
  const RING_WIDTH = 6
  const cx = size / 2
  const cy = size / 2
  const rOuter = hasUnquantified ? size / 2 - RING_WIDTH : size / 2
  const rMid = rOuter * 0.62

  // No quantified data at all (only unquantified types) — nothing to draw
  // a pie from, so skip straight to a legend that's just the warning row.
  const groups: RenderGroup[] =
    total > 0
      ? data.reduce<{ cursor: number; groups: RenderGroup[] }>(
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
                {
                  label: g.label,
                  labelEn: g.labelEn,
                  value: g.value,
                  color: baseColor,
                  startAngle,
                  endAngle,
                  children,
                  unquantifiedChildren: g.unquantifiedChildren ?? [],
                },
              ],
            }
          },
          { cursor: 0, groups: [] }
        ).groups
      : []

  return (
    <div className="flex flex-wrap items-start gap-4">
      {(total > 0 || hasUnquantified) && (
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
          {hasUnquantified && (
            <circle
              cx={cx}
              cy={cy}
              r={rOuter + RING_WIDTH / 2}
              fill="none"
              stroke={UNCLASSIFIED_COLOR}
              strokeWidth={RING_WIDTH}
            >
              <title>{`${unquantified.length} unquantified type(s) not shown as slices`}</title>
            </circle>
          )}
        </svg>
      )}

      {showLegend && (
      <ul className="min-w-[220px] flex-1 space-y-1.5 text-xs">
        {groups.map((g) => {
          const hasInscriptions = g.children.length > 1
          const dropdown = hasDropdown(g)
          const isExpanded = expandedTypes.has(g.label)
          return (
          <li key={g.label}>
            <div
              className={`flex items-start justify-between gap-2 font-semibold ${
                dropdown ? 'cursor-pointer select-none hover:text-brand' : ''
              }`}
              role={dropdown ? 'button' : undefined}
              tabIndex={dropdown ? 0 : undefined}
              aria-expanded={dropdown ? isExpanded : undefined}
              onClick={dropdown ? () => toggleType(g.label) : undefined}
              onKeyDown={
                dropdown
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
                    dropdown ? '' : 'invisible'
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
            {dropdown && isExpanded && (
              <ul className="ml-[34px] mt-0.5 space-y-0.5">
                {hasInscriptions &&
                  g.children.map((c) => (
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
                {g.unquantifiedChildren.map((u, i) => (
                  <li
                    key={`unq-${u.subtypeLabel ?? ''}-${u.inscriptionLabel}-${i}`}
                    className="flex items-start justify-between gap-2 text-gray-500"
                  >
                    <span className="flex items-start gap-1.5">
                      <UnquantifiedSwatch className="mt-0.5 h-2 w-2" />
                      <span>
                        {u.subtypeLabel && (
                          <>
                            {u.subtypeLabel}
                            {u.subtypeLabelEn && u.subtypeLabelEn !== u.subtypeLabel && (
                              <span className="ml-1 italic text-gray-400">{u.subtypeLabelEn}</span>
                            )}
                            <span className="text-gray-400"> · </span>
                          </>
                        )}
                        {u.inscriptionLabel}
                        {u.inscriptionLabelEn && u.inscriptionLabelEn !== u.inscriptionLabel && (
                          <span className="ml-1 italic text-gray-400">{u.inscriptionLabelEn}</span>
                        )}
                      </span>
                    </span>
                    {u.count > 1 && <span className="shrink-0 tabular-nums text-gray-400">×{u.count}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
          )
        })}
        {unquantified.length > 0 && (
          <li>
            <div
              className="flex cursor-pointer select-none items-start justify-between gap-2 font-semibold hover:text-brand"
              role="button"
              tabIndex={0}
              aria-expanded={showUnquantified}
              onClick={() => setShowUnquantified((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowUnquantified((v) => !v)
                }
              }}
            >
              <span className="flex items-start gap-1.5">
                <span
                  className={`mt-0.5 w-3 shrink-0 text-center text-[9px] text-gray-400 transition-transform ${
                    showUnquantified ? 'rotate-90' : ''
                  }`}
                  aria-hidden="true"
                >
                  ▶
                </span>
                <UnquantifiedSwatch />
                <span className="text-gray-800">
                  未计数类型
                  <span className="ml-1 italic font-normal text-gray-400">Unquantified types</span>
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-gray-500">{unquantified.length}</span>
            </div>
            {showUnquantified && (
              <ul className="ml-[34px] mt-0.5 space-y-0.5">
                {unquantified.map((u, i) => (
                  <li key={`${u.label}-${u.inscriptionLabel}-${i}`} className="text-gray-600">
                    <span>
                      {u.label}
                      {u.labelEn && u.labelEn !== u.label && (
                        <span className="ml-1 italic text-gray-400">{u.labelEn}</span>
                      )}
                    </span>
                    <span className="text-gray-400"> · </span>
                    <span>
                      {u.inscriptionLabel}
                      {u.inscriptionLabelEn && u.inscriptionLabelEn !== u.inscriptionLabel && (
                        <span className="ml-1 italic text-gray-400">{u.inscriptionLabelEn}</span>
                      )}
                    </span>
                    {u.count > 1 && <span className="ml-1 text-gray-400">×{u.count}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
      )}
    </div>
  )
}
