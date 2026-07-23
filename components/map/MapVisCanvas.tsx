'use client'

/**
 * Pure map, shared by both map-visualization tabs: every find site or every
 * mint town as a marker, both driven by the exact same mechanism — colored
 * by filter-match state (`stateColor`), sized by raw coin quantity
 * (`siteSizeByQuantity`), and built from the same `dot()` HTML/`SiteHeatState`
 * machinery (`kind: 'sites'` uses `siteStates` computed by the caller;
 * `kind: 'mints'` uses an analogous `mintStates` map — matched-vs-total coin
 * count per mint town instead of per site). Both kinds share the same
 * base-layer setup, resize handling, and density heat-layer rendering. No
 * sidebar, no legend, no padding — just the map.
 *
 * Used by: components/visualizations/MapVisualization.tsx (FindSpotsVisualization
 * and MintTownVisualization, the find-site and mint-town pages), which own
 * the filter state and render the overlay controls + legend around it.
 */

import { useEffect, useRef, useState } from 'react'
import type { HeatLayer, Map as LeafletMap, Marker } from 'leaflet'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TFunction } from '@/lib/i18n/LanguageContext'
import {
  NO_DATA_ALPHA,
  NO_DATA_COLOR,
  PRESENT_UNQUANTIFIED_COLOR,
  SINGLE_FIND_COLOR,
  buildDensityGradient,
  hexToRgba,
  ratioToColor,
  readHeatmapOpacity,
} from '@/lib/color-scale'
import {
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'
import type { FilterMode, SiteHeatState, ViewMode } from '@/lib/context-heatmap'
import { toEnglishName } from '@/lib/name-translation'
import type { MapSite } from '@/lib/types'

/**
 * Presentation-layer state: `pure` (from context-heatmap.ts) only means "every
 * find in this context/site matches" — it says nothing about how many coins
 * that is. A point whose *only* recorded coin (across all types) matches the
 * filter is a much more notable "single find" and gets its own color; a
 * larger all-match point just renders like any other 100%-ratio point.
 */
type DisplayState = SiteHeatState | { kind: 'single-find' }

function toDisplayState(state: SiteHeatState, totalQty: number): DisplayState {
  if (state.kind === 'pure' && totalQty === 1) {
    return { kind: 'single-find' }
  }
  return state
}

// Note: this map's fill colors are state-driven (stateColor() below, backed
// by lib/color-scale.ts's match-ratio gradient, including one genuinely
// continuous interpolation) rather than fixed per-marker-role classes like
// the other maps' simple site/mint dots — they're the "heatmap colors" this
// map is built around, so they can't be pre-enumerated in app/maps.css.
// Fill color is set via the scoped CSS custom property `.map-dot-ratio`
// reads (--dot-fill); border-color is never overridden here, same shared
// `--map-dot-border` as every other role. Size is set with an inline
// width/height alongside so it isn't limited to the fixed `.map-dot-size-N`
// steps in app/maps.css (quantity sizing is continuous, not one of the
// fixed steps).
function dot(color: string, size = 14) {
  return `<div class="map-dot map-dot-ratio" style="--dot-fill:${color};width:${size}px;height:${size}px"></div>`
}

// "No record at all" marker — fixed size + color, both set in app/maps.css
// (`.map-dot-no-data`) rather than computed inline, since neither varies.
const NO_DATA_DOT_SIZE = 12
function noDataDot() {
  return `<div class="map-dot map-dot-no-data"></div>`
}

const PIN_WIDTH = 22
const PIN_HEIGHT = 30

// A classic teardrop map pin, fully opaque (solid `fill`, no CSS opacity) —
// unlike dot()'s color, which is deliberately alpha-blended for the
// heatmap's match-ratio reading, a pin should never look "faded." Used both
// for user-selected PinPoints below and, in applyHeatMarkerStyle, for a
// "single-find" site/mint (its one recorded coin makes it a much more
// notable point than a same-sized ratio dot would suggest).
function dropPinHtml(color: string): string {
  return `<svg width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="11" cy="11" r="4" fill="white"/></svg>`
}

/** Min/max pixel size for quantity-driven sizing, read from app/maps.css's
 * `--map-dot-qty-size-min` / `-max` so the CSS file stays the single source
 * of truth. Read once per restyle pass, not per marker. */
function dotSizeRange(): { min: number; max: number } {
  const styles = getComputedStyle(document.documentElement)
  const min = parseFloat(styles.getPropertyValue('--map-dot-qty-size-min'))
  const max = parseFloat(styles.getPropertyValue('--map-dot-qty-size-max'))
  return { min: Number.isFinite(min) ? min : 14, max: Number.isFinite(max) ? max : 26 }
}

// Size is its own channel, independent of match state/color: it always
// reflects the point's raw coin quantity relative to the current list's
// max, anchored so a single coin sits exactly at `min` (log(1) === 0) and
// grows logarithmically from there up to `max`.
function siteSizeByQuantity(qty: number, maxQty: number, min: number, max: number): number {
  if (qty <= 1 || maxQty <= 1) return min
  const t = Math.log(qty) / Math.log(maxQty)
  return Math.round(min + t * (max - min))
}

const COIN_TYPE_TRANSLATIONS: Record<string, string> = {
  布币: 'Spade Coin',
  刀币: 'Knife-Shaped Coin',
  圜钱: 'Round Coin',
  蚁鼻钱: 'Cowrie Coin',
  金版: 'Gold Plate',
}

function formatCoinTypeBilingual(value: string | null) {
  if (!value) return '—'
  return value
    .split(/[、,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((zh) => {
      const en = COIN_TYPE_TRANSLATIONS[zh]
      return en ? `${zh} (${en})` : zh
    })
    .join('、')
}

/**
 * `opacity` only affects the "point color" branches (the ratio/single-find/
 * unquantified hues) — pass it for the actual map marker; leave it at the
 * default (1, fully opaque) for other uses of this color, like the popup's
 * ratio bar or a legend swatch, which should stay fully saturated. `no-data`
 * always keeps its own dedicated `NO_DATA_ALPHA`, regardless of `opacity`.
 */
function stateColor(state: DisplayState, opacity = 1): string {
  switch (state.kind) {
    case 'no-filter':
      // Default/unfiltered look matches the "100% match" color everywhere.
      return hexToRgba(ratioToColor(1), opacity)
    case 'no-data':
      return hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA)
    case 'unquantified':
      return hexToRgba(PRESENT_UNQUANTIFIED_COLOR, opacity)
    case 'single-find':
      return hexToRgba(SINGLE_FIND_COLOR, opacity)
    case 'pure':
      return hexToRgba(ratioToColor(1), opacity)
    case 'ratio':
      // A true 0% match reads as "disabled" grey, not the palest step of the
      // ratio ramp — see the ratioToColor() doc comment in color-scale.ts.
      return state.ratio <= 0
        ? hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA)
        : hexToRgba(ratioToColor(state.ratio), opacity)
  }
}

/** Matched/total coin counts implied by a state, for the popup's numeric
 * "x of y (~z%)" line + bar — null when there's nothing countable to show
 * (no filter active, or present-but-unquantified). */
function ratioNumbers(state: DisplayState, totalQtyFallback: number): { matched: number; total: number } | null {
  switch (state.kind) {
    case 'ratio':
      return { matched: state.matchedQty, total: state.totalQty }
    case 'pure':
    case 'single-find':
      return { matched: totalQtyFallback, total: totalQtyFallback }
    case 'no-data':
      return { matched: 0, total: totalQtyFallback }
    case 'no-filter':
    case 'unquantified':
      return null
  }
}

/** The popup's status text: always the uniform "{matched} of {total} coins
 * (~{pct}%)" format — including 0%, 100%, and the 1-of-1 case — for every
 * state with a computable count. The only exceptions are `unquantified`
 * (type present but no usable quantity — genuinely unrecorded) and the
 * degenerate zero-total case (nothing to compute a percentage from at
 * all), which keep their own text; `no-filter` shows nothing. */
function statusLine(state: DisplayState, totalQty: number, t: TFunction): string | null {
  if (state.kind === 'no-filter') return null
  if (state.kind === 'unquantified') return t('heatmap.popup.presentNoCount')
  const nums = ratioNumbers(state, totalQty)
  if (!nums || nums.total <= 0) return t('heatmap.popup.noRecord')
  return t('heatmap.popup.ratio', {
    matched: nums.matched,
    total: nums.total,
    pct: Math.round((nums.matched / nums.total) * 100),
  })
}

function ratioBarHtml(pct: number, color: string): string {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  return `<div style="height:6px;width:100%;border-radius:3px;background:#e2e2e2;overflow:hidden;margin-top:3px"><div style="height:100%;width:${clamped}%;background:${color}"></div></div>`
}

/** Shared "x of y coins (~z%)" line + bar, used by both the site and mint
 * popups so a filtered point's match share reads identically everywhere. */
function ratioStatusHtml(state: DisplayState, totalQty: number, t: TFunction): string {
  const text = statusLine(state, totalQty, t)
  if (!text) return ''
  const nums = ratioNumbers(state, totalQty)
  const bar = nums && nums.total > 0 ? ratioBarHtml((nums.matched / nums.total) * 100, stateColor(state)) : ''
  return `<div>${text}</div>${bar}<hr style="margin:8px 0;border:none;border-top:1px solid #ddd" />`
}

function buildPopupHtml(site: MapSite, state: DisplayState, t: TFunction): string {
  const nameZh = site.site_name_zh ?? '未命名遗址'
  const nameEn = toEnglishName(site.site_name_zh, site.site_name_en)
  const provinceZh = site.province_zh ?? '—'
  const provinceEn = toEnglishName(site.province_zh, site.province_en)
  const cityZh = site.city_zh ?? '—'
  const cityEn = toEnglishName(site.city_zh, site.city_en)
  const countyZh = site.county_zh ?? '—'
  const countyEn = toEnglishName(site.county_zh, site.county_en)
  const typeBilingual = formatCoinTypeBilingual(site.level2_types_zh)
  const status = ratioStatusHtml(state, site.total_quantity_for_map ?? 0, t)

  return `
    <div style="min-width:250px;font-size:12.5px;font-family:sans-serif;line-height:1.6">
      ${status}
      <div><strong>Site name / 遗址：</strong>${nameZh}${nameEn ? ` <span style="color:#888;font-style:italic">${nameEn}</span>` : ''}</div>
      <div><strong>Province / 省：</strong>${provinceZh}${provinceEn ? ` <span style="color:#888">(${provinceEn})</span>` : ''}</div>
      <div><strong>City / 市：</strong>${cityZh}${cityEn ? ` <span style="color:#888">(${cityEn})</span>` : ''}</div>
      <div><strong>County / 县：</strong>${countyZh}${countyEn ? ` <span style="color:#888">(${countyEn})</span>` : ''}</div>
      <div><strong>Coin type / 币类：</strong>${typeBilingual}</div>
      <div><strong>Quantity / 数量：</strong>${site.total_quantity_for_map ?? 0}</div>
      <a href="/sites/${site.site_code}" style="color:#006d71;font-size:12px">${t('search.viewRecord')}</a>
    </div>
  `
}

/**
 * One (location, group) pair for a map's Compare view — a location (a find
 * site, or a mint town) with matches from N selected groups (mints, or coin
 * types) contributes N of these, one per group, each its own identity color
 * (see lib/color-scale.ts's SELECTION_COLORS) instead of the usual
 * match-ratio color. Plain round dots (dot()), not PinPoint's teardrop —
 * Compare recolors the ordinary markers, it doesn't add new pins. Generic
 * over what's being compared (mint vs. coin type) so every map's Compare
 * view (Find Site by mint/by type, the database Mint Town tab, Museum
 * Collections' Mint Town view) shares this one point shape.
 */
export type ComparePoint = {
  /** Stable identity for reconciling markers across renders. */
  key: string
  /** Groups points that share a location, for the small stacking offset
   * that keeps same-location points visually distinct instead of exactly
   * overlapping (they share a lat/lng by definition) — a site_code for
   * Find Site, a mint's name_zh for the Mint Town-shaped maps. */
  groupKey: string
  lat: number
  lng: number
  color: string
  /** This group's own coin quantity at this location — drives marker size,
   * same siteSizeByQuantity() scale as every other point on this map. */
  qty: number
  /** The location's own name (site name, or mint town name). */
  locationLabel: string
  /** The compared group's own name (a mint's name, or a coin type's
   * label). */
  groupLabel: string
  /** Short bilingual prefix identifying what kind of group this is (e.g.
   * "Mint / 铸地：" or "Type / 类型："), so the popup reads correctly
   * regardless of what's being compared. */
  groupKindLabel: string
  href?: string
}

function buildComparePopupHtml(point: ComparePoint, t: TFunction): string {
  const link = point.href
    ? `<a href="${point.href}" style="color:#006d71;font-size:12px">${t('search.viewRecord')}</a>`
    : ''
  return `
    <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:180px">
      <strong>${point.locationLabel}</strong><br/>
      <strong>${point.groupKindLabel}</strong>${point.groupLabel}<br/>
      <strong>Coins:</strong> ${point.qty}<br/>
      ${link}
    </div>
  `
}

/** Small fixed pixel offset (not a lat/lng jitter, so it stays the same
 * size at every zoom level) so markers that share an exact coordinate fan
 * out around it instead of exactly overlapping — used both for Compare's
 * same-site points and for Museum Collections' selection pins when several
 * selected specimens share a mint. */
function stackOffset(index: number, total: number, radius: number): [number, number] {
  if (total <= 1) return [0, 0]
  const angle = (2 * Math.PI * index) / total
  return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]
}

/** One mint town, aggregated regardless of the active filter (coordinates +
 * "typical information" — always the mint's full totals/inscriptions, not
 * just what currently matches). */
export type MintPoint = {
  mint_zh: string
  mint_en: string | null
  mint_code: string | null
  lat: number
  lng: number
  totalQty: number
  inscriptions: string[]
  modern_location_en: string | null
}

function buildMintPopupHtml(mint: MintPoint, state: DisplayState, t: TFunction): string {
  const status = ratioStatusHtml(state, mint.totalQty, t)

  return `
    <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:180px">
      ${status}
      <strong>${mint.mint_zh}${mint.mint_en ? ` <span style="color:#888;font-style:italic">(${mint.mint_en})</span>` : ''}</strong><br/>
      <strong>Coins:</strong> ${mint.totalQty}<br/>
      ${mint.inscriptions.length > 0 ? `<strong>Inscriptions:</strong> ${mint.inscriptions.slice(0, 6).join('、')}${mint.inscriptions.length > 6 ? '…' : ''}<br/>` : ''}
      ${mint.modern_location_en ? `${mint.modern_location_en}<br/>` : ''}
      ${mint.mint_code ? `<a href="/mints/${mint.mint_code}" style="color:#006d71">View mint town →</a>` : ''}
    </div>
  `
}

/** Recomputes a marker's icon/opacity/z-index/popup from its current heat
 * state — the one piece of restyle logic shared by both sites and mints.
 * `hidden` is Compare view's escape hatch: the ordinary per-site markers
 * still exist (built once in the init effect) but sit fully invisible while
 * Compare's own marker set (ComparePoint, reconciled separately below) is
 * what's actually shown. */
function applyHeatMarkerStyle(
  L: typeof import('leaflet'),
  marker: Marker,
  rawState: SiteHeatState | undefined,
  totalQty: number,
  maxQty: number,
  sizeRange: { min: number; max: number },
  pointOpacity: number,
  inDensity: boolean,
  popupHtml: string,
  hidden = false
) {
  if (hidden) {
    marker.setIcon(L.divIcon({ className: '', html: '', iconSize: [0, 0], iconAnchor: [0, 0] }))
    marker.setOpacity(0)
    return
  }

  const state = toDisplayState(rawState ?? { kind: 'no-filter' }, totalQty)
  const isStaticNoData = !inDensity && state.kind === 'no-data'
  const color = inDensity
    ? state.kind === 'no-data'
      ? 'transparent'
      : 'rgba(40,40,40,0.45)'
    : stateColor(state, pointOpacity)
  const size = inDensity
    ? state.kind === 'no-data'
      ? 0
      : 7
    : // No-data points stay small and fixed (not quantity-scaled) — there's
      // nothing to size by for a type/mint that isn't recorded there at all.
      isStaticNoData
      ? NO_DATA_DOT_SIZE
      : // Present but the matching quantity wasn't recorded — sized as if it
        // were 20% of the location's total, a conservative stand-in that
        // still reflects scale without claiming a count we don't have.
        state.kind === 'unquantified'
        ? siteSizeByQuantity(totalQty * 0.2, maxQty, sizeRange.min, sizeRange.max)
        : siteSizeByQuantity(totalQty, maxQty, sizeRange.min, sizeRange.max)

  // A single-find point (Points mode only — density blends everything into
  // the heat layer instead) gets a dropped pin rather than a same-sized dot,
  // so its one recorded coin actually stands out instead of reading as just
  // another small ratio dot.
  const isSingleFindPin = !inDensity && state.kind === 'single-find'

  marker.setIcon(
    isSingleFindPin
      ? L.divIcon({
          className: '',
          html: dropPinHtml(color),
          iconSize: [PIN_WIDTH, PIN_HEIGHT],
          iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
        })
      : L.divIcon({
          className: '',
          html: size > 0 ? (isStaticNoData ? noDataDot() : dot(color, size)) : '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })
  )
  marker.setOpacity(inDensity && state.kind === 'no-data' ? 0 : 1)
  marker.setZIndexOffset(
    state.kind === 'no-data'
      ? -1000
      : state.kind === 'pure' || state.kind === 'single-find' || state.kind === 'ratio'
        ? 500
        : 0
  )
  marker.setPopupContent(popupHtml)
}

/** A user-selected point — a specimen picked in the Museum Collections
 * search, or a mint picked in Find Site's "by mint" multiselect — rendered
 * as its own dropped pin on top of the regular circle markers. One per
 * selection, each in its own fixed identity color (see lib/color-scale.ts's
 * SELECTION_COLORS), fully opaque regardless of the heatmap opacity setting
 * so a selection always reads clearly. Replaces the old single-mint
 * "highlight" square marker, which only ever supported one selection at a
 * time. */
export type PinPoint = {
  /** Stable identity for reconciling markers across renders — doesn't need
   * to match anything else on the map. */
  key: string
  lat: number
  lng: number
  color: string
  label: string
  href?: string
  /** Open `href` in a new tab (external links) instead of same-tab nav
   * (internal links, e.g. a mint's own /mints/[code] page). */
  hrefExternal?: boolean
}

function buildPinPopupHtml(pin: PinPoint): string {
  const linkAttrs = pin.hrefExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  const arrow = pin.hrefExternal ? ' ↗' : ' →'
  const label = pin.href
    ? `<a href="${pin.href}"${linkAttrs} style="color:#006d71;font-weight:600">${pin.label}${arrow}</a>`
    : `<strong>${pin.label}</strong>`
  return `<div style="font-family:sans-serif;font-size:13px;line-height:1.5">${label}</div>`
}

type SitesCanvasProps = {
  kind: 'sites'
  sites: MapSite[]
  mode: FilterMode
  siteStates: Map<string, SiteHeatState> | null
  viewMode: ViewMode
  densityLatLngs: [number, number, number][]
  filterActive: boolean
  /** User-selected points (Find Site's "by mint" multiselect) — see PinPoint. */
  pins?: PinPoint[]
  /** Compare view's per-(site, mint) points — see ComparePoint. Only
   * meaningful (and only supplied) when viewMode === 'compare'. */
  comparePoints?: ComparePoint[]
  /** Full layer-switcher + river-mode controls (desktop only regardless).
   * Default true — the two dedicated Map Visualizations pages want this;
   * anywhere else this canvas gets embedded (e.g. the /mints overview map)
   * should pass `false` to get the same controls-off, static-major-rivers
   * treatment every other single-page map uses. */
  fullControls?: boolean
  height?: string
}

type MintsCanvasProps = {
  kind: 'mints'
  mintPoints: MintPoint[]
  mintStates: Map<string, SiteHeatState> | null
  viewMode: ViewMode
  densityLatLngs: [number, number, number][]
  /** User-selected points (Museum Collections search) — see PinPoint. */
  pins?: PinPoint[]
  /** Compare view's per-(mint, group) points — see ComparePoint. Only
   * meaningful (and only supplied) when viewMode === 'compare'. */
  comparePoints?: ComparePoint[]
  /** See SitesCanvasProps.fullControls. */
  fullControls?: boolean
  height?: string
}

export type MapVisCanvasProps = SitesCanvasProps | MintsCanvasProps

export function MapVisCanvas(props: MapVisCanvasProps) {
  const { viewMode, densityLatLngs, height = '100%' } = props
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const pointMarkersRef = useRef<Map<string, Marker>>(new Map())
  const pinMarkersRef = useRef<Map<string, Marker>>(new Map())
  const compareMarkersRef = useRef<Map<string, Marker>>(new Map())
  const heatLayerRef = useRef<HeatLayer | null>(null)
  // Flips true once the init effect's async `import('leaflet')` has actually
  // created `mapRef.current` — the restyle effect below bails out if the map
  // doesn't exist yet, which it never does on the very first run (init's map
  // creation is itself async, so it hasn't necessarily resolved before this
  // effect's first pass). Without this, a canvas that mounts with non-default
  // props already set (e.g. a deep-linked Compare view) would render its
  // markers with the init effect's hardcoded placeholder style and never get
  // restyled, since nothing else would trigger the restyle effect again.
  const [mapReady, setMapReady] = useState(false)

  // Kind-specific fields, pulled out of the discriminated union once so effect
  // dependency arrays below stay simple, statically-checkable expressions.
  const statesForRestyle = props.kind === 'sites' ? props.siteStates : props.mintStates
  const sitesForRestyle = props.kind === 'sites' ? props.sites : null
  const modeForSites = props.kind === 'sites' ? props.mode : null
  const filterActiveForSites = props.kind === 'sites' ? props.filterActive : null
  const sitesForInit = props.kind === 'sites' ? props.sites : null
  const pins = props.pins ?? []
  const comparePoints = props.comparePoints ?? []

  // Restyle existing markers + toggle the density heat layer. Runs on every
  // filter/view-mode change but never rebuilds the map itself.
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(async ({ default: L }) => {
      const map = mapRef.current
      if (!map) return

      // Ensure leaflet.heat attaches to this Leaflet instance
      const g = globalThis as typeof globalThis & { L?: typeof L }
      g.L = L
      await import('leaflet.heat')

      const inDensity = viewMode === 'density'
      const inCompare = viewMode === 'compare'
      const sizeRange = dotSizeRange()
      const pointOpacity = readHeatmapOpacity()

      if (props.kind === 'sites') {
        const { sites, siteStates } = props
        const maxQty = Math.max(...sites.map((s) => s.total_quantity_for_map ?? 0), 1)
        pointMarkersRef.current.forEach((marker, code) => {
          const site = sites.find((s) => s.site_code === code)
          if (!site) return
          const totalQty = site.total_quantity_for_map ?? 0
          const rawState = siteStates?.get(code)
          applyHeatMarkerStyle(
            L,
            marker,
            rawState,
            totalQty,
            maxQty,
            sizeRange,
            pointOpacity,
            inDensity,
            buildPopupHtml(site, toDisplayState(rawState ?? { kind: 'no-filter' }, totalQty), t),
            inCompare
          )
        })
      } else {
        const { mintPoints, mintStates } = props
        const maxQty = Math.max(...mintPoints.map((m) => m.totalQty), 1)
        pointMarkersRef.current.forEach((marker, mintZh) => {
          const mint = mintPoints.find((m) => m.mint_zh === mintZh)
          if (!mint) return
          const rawState = mintStates?.get(mintZh)
          applyHeatMarkerStyle(
            L,
            marker,
            rawState,
            mint.totalQty,
            maxQty,
            sizeRange,
            pointOpacity,
            inDensity,
            buildMintPopupHtml(mint, toDisplayState(rawState ?? { kind: 'no-filter' }, mint.totalQty), t),
            inCompare
          )
        })
      }

      // User-selected pins (Museum Collections search, Find Site's "by
      // mint" multiselect) — reconciled by key so an in-place color/position
      // update doesn't flicker a marker. Grouped by exact coordinate first:
      // several selected specimens can share a mint town (Museum
      // Collections), and without an offset their pins would sit exactly on
      // top of each other with only the topmost one visible/clickable.
      const nextPinKeys = new Set(pins.map((p) => p.key))
      pinMarkersRef.current.forEach((marker, key) => {
        if (nextPinKeys.has(key)) return
        map.removeLayer(marker)
        pinMarkersRef.current.delete(key)
      })
      const pinGroups = new Map<string, PinPoint[]>()
      pins.forEach((pin) => {
        const groupKey = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`
        if (!pinGroups.has(groupKey)) pinGroups.set(groupKey, [])
        pinGroups.get(groupKey)!.push(pin)
      })
      let pinZIndex = 0
      pinGroups.forEach((group) => {
        group.forEach((pin, i) => {
          const [offsetX, offsetY] = stackOffset(i, group.length, 12)
          const icon = L.divIcon({
            className: '',
            html: dropPinHtml(pin.color),
            iconSize: [PIN_WIDTH, PIN_HEIGHT],
            iconAnchor: [PIN_WIDTH / 2 + offsetX, PIN_HEIGHT + offsetY],
            popupAnchor: [0, -PIN_HEIGHT],
          })
          const existing = pinMarkersRef.current.get(pin.key)
          if (existing) {
            existing.setLatLng([pin.lat, pin.lng])
            existing.setIcon(icon)
            existing.setZIndexOffset(2000 + pinZIndex)
            existing.setPopupContent(buildPinPopupHtml(pin))
          } else {
            const marker = L.marker([pin.lat, pin.lng], { icon, zIndexOffset: 2000 + pinZIndex })
              .addTo(map)
              .bindPopup(buildPinPopupHtml(pin))
            pinMarkersRef.current.set(pin.key, marker)
          }
          pinZIndex += 1
        })
      })

      // Compare view's own marker set — reconciled independently of the
      // ordinary per-site markers above (which sit hidden via `inCompare`
      // in applyHeatMarkerStyle while this is active). Grouped by location
      // so same-location points get the small stacking offset.
      if (inCompare) {
        const byLocation = new Map<string, ComparePoint[]>()
        comparePoints.forEach((point) => {
          if (!byLocation.has(point.groupKey)) byLocation.set(point.groupKey, [])
          byLocation.get(point.groupKey)!.push(point)
        })
        const maxCompareQty = Math.max(...comparePoints.map((p) => p.qty), 1)

        const nextCompareKeys = new Set(comparePoints.map((p) => p.key))
        compareMarkersRef.current.forEach((marker, key) => {
          if (nextCompareKeys.has(key)) return
          map.removeLayer(marker)
          compareMarkersRef.current.delete(key)
        })

        byLocation.forEach((points) => {
          points.forEach((point, i) => {
            const size = siteSizeByQuantity(point.qty, maxCompareQty, sizeRange.min, sizeRange.max)
            const [offsetX, offsetY] = stackOffset(i, points.length, 9)
            const icon = L.divIcon({
              className: '',
              // Same alpha as the ordinary ratio-colored points (pointOpacity)
              // — only the dropped pin (dropPinHtml) is meant to be fully
              // opaque; Compare's points should look like normal points.
              html: dot(hexToRgba(point.color, pointOpacity), size),
              iconSize: [size, size],
              iconAnchor: [size / 2 + offsetX, size / 2 + offsetY],
            })
            const popupHtml = buildComparePopupHtml(point, t)
            const existing = compareMarkersRef.current.get(point.key)
            if (existing) {
              existing.setLatLng([point.lat, point.lng])
              existing.setIcon(icon)
              existing.setPopupContent(popupHtml)
            } else {
              const marker = L.marker([point.lat, point.lng], { icon }).addTo(map).bindPopup(popupHtml)
              compareMarkersRef.current.set(point.key, marker)
            }
          })
        })
      } else if (compareMarkersRef.current.size > 0) {
        compareMarkersRef.current.forEach((marker) => map.removeLayer(marker))
        compareMarkersRef.current.clear()
      }

      try {
        if (inDensity && densityLatLngs.length > 0) {
          if (!heatLayerRef.current) {
            heatLayerRef.current = L.heatLayer(densityLatLngs, {
              radius: 32,
              blur: 26,
              maxZoom: 9,
              max: 1,
              minOpacity: 0.25,
              gradient: buildDensityGradient(readHeatmapOpacity()),
            }).addTo(map)
          } else {
            heatLayerRef.current.setLatLngs(densityLatLngs)
            if (!map.hasLayer(heatLayerRef.current)) heatLayerRef.current.addTo(map)
          }
        } else if (heatLayerRef.current) {
          map.removeLayer(heatLayerRef.current)
          heatLayerRef.current = null
        }
      } catch (err) {
        // leaflet.heat is a legacy global-style plugin patched onto `L` above;
        // fail soft (log + skip the overlay) rather than crash the whole map
        // if that patching ever doesn't line up in a given environment.
        console.error('Failed to render the density heat overlay:', err)
        heatLayerRef.current = null
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, statesForRestyle, sitesForRestyle, modeForSites, pins, comparePoints, t, viewMode, densityLatLngs])

  // Build the map + initial markers once. For `sites`, re-runs if the site
  // list itself changes (e.g. a precision-filter navigation). For `mints`,
  // the mint list is stable regardless of the coin-type filter (every known
  // mint town is always registered, just with a different matched count), so
  // this never needs to re-run for a filter tweak — only marker styling
  // (above) reacts to that.
  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addLayerControl, addStaticMajorRivers } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current || mapRef.current) return

      const center: [number, number] = props.kind === 'sites' ? [35.8, 105.4] : [37.5, 112]
      const zoom = props.kind === 'sites' ? 4 : 6
      const map = L.map(containerRef.current, { zoomControl: false }).setView(center, zoom)
      mapRef.current = map
      L.control.zoom({ position: 'topright' }).addTo(map)

      const { osm, cyclosm, satellite, satelliteLabels } = buildBaseLayers(L)
      cyclosm.addTo(map)

      // Full layer-switcher + river-mode controls are reserved for the
      // dedicated Map Visualizations pages (fullControls, default true),
      // desktop only — on mobile, or wherever this canvas is embedded
      // elsewhere with fullControls={false} (e.g. the /mints overview map),
      // it drops back to the same "just the bilingual labels + static major
      // rivers" baseline every other map on the site uses.
      const isMobile = window.matchMedia('(max-width: 768px)').matches
      if (isMobile || props.fullControls === false) {
        satelliteLabels.addTo(map)
        addStaticMajorRivers(L, map)
      } else {
        addLayerControl(L, map, cyclosm, osm, satellite, satelliteLabels, {
          collapsed: true,
          position: 'bottomright',
        })
      }

      const bounds: [number, number][] = []
      const initialColor = hexToRgba(ratioToColor(1), readHeatmapOpacity())
      const sizeRange = dotSizeRange()

      if (props.kind === 'sites') {
        const { sites } = props
        const maxQty = Math.max(...sites.map((s) => s.total_quantity_for_map ?? 0), 1)
        sites.forEach((site) => {
          if (site.lat == null || site.lng == null) return
          bounds.push([site.lat, site.lng])

          const size = siteSizeByQuantity(site.total_quantity_for_map ?? 0, maxQty, sizeRange.min, sizeRange.max)
          const marker = L.marker([site.lat, site.lng], {
            icon: L.divIcon({
              className: '',
              html: dot(initialColor, size),
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
          })
            .addTo(map)
            .bindPopup(buildPopupHtml(site, { kind: 'no-filter' }, t))

          pointMarkersRef.current.set(site.site_code, marker)
        })

        const candidateCities = new Map<string, { cityZh: string; provinceZh?: string | null }>()
        sites.forEach((site) => {
          if (!shouldShowCityBoundary(site) || !site.city_zh) return
          const key = `${site.province_zh ?? ''}::${site.city_zh}`
          if (!candidateCities.has(key)) {
            candidateCities.set(key, { cityZh: site.city_zh, provinceZh: site.province_zh })
          }
        })
        if (candidateCities.size > 0) {
          const layer = L.layerGroup().addTo(map)
          await Promise.all(
            [...candidateCities.values()].map(async ({ cityZh, provinceZh }) => {
              const geo = await fetchCityBoundaryGeoJson(cityZh, provinceZh)
              if (!geo || cancelled) return
              L.geoJSON(geo as GeoJSON.GeoJsonObject, {
                style: {
                  color: '#8e8e8e',
                  weight: 1.5,
                  opacity: 0.9,
                  fillColor: '#bfbfbf',
                  fillOpacity: 0.1,
                  dashArray: '4 4',
                },
              }).addTo(layer)
            })
          )
        }

        if (cancelled) return

        const candidateCounties = new Map<
          string,
          { countyZh: string; cityZh?: string | null; provinceZh?: string | null }
        >()
        sites.forEach((site) => {
          if (!shouldShowCountyBoundary(site) || !site.county_zh) return
          const key = `${site.province_zh ?? ''}::${site.city_zh ?? ''}::${site.county_zh}`
          if (!candidateCounties.has(key)) {
            candidateCounties.set(key, {
              countyZh: site.county_zh,
              cityZh: site.city_zh,
              provinceZh: site.province_zh,
            })
          }
        })
        if (candidateCounties.size > 0) {
          const layer = L.layerGroup().addTo(map)
          await Promise.all(
            [...candidateCounties.values()].map(async ({ countyZh, cityZh, provinceZh }) => {
              const geo = await fetchCountyBoundaryGeoJson(countyZh, cityZh, provinceZh)
              if (!geo || cancelled) return
              L.geoJSON(geo as GeoJSON.GeoJsonObject, {
                style: {
                  color: '#6f6f6f',
                  weight: 2,
                  opacity: 0.9,
                  fillColor: '#b5b5b5',
                  fillOpacity: 0.14,
                  dashArray: '2 3',
                },
              }).addTo(layer)
            })
          )
        }
      } else {
        // Some mint towns have no known coordinates yet — plotting them
        // would push NaN into fitBounds and break Leaflet's internal
        // position tracking (the `_leaflet_pos` crash), so skip them here
        // too even though callers are expected to have filtered already.
        const plottableMints = props.mintPoints.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        const maxQty = Math.max(...plottableMints.map((m) => m.totalQty), 1)
        plottableMints.forEach((mint) => {
          bounds.push([mint.lat, mint.lng])

          const size = siteSizeByQuantity(mint.totalQty, maxQty, sizeRange.min, sizeRange.max)
          const marker = L.marker([mint.lat, mint.lng], {
            icon: L.divIcon({
              className: '',
              html: dot(initialColor, size),
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
          })
            .addTo(map)
            .bindPopup(buildMintPopupHtml(mint, { kind: 'no-filter' }, t))

          pointMarkersRef.current.set(mint.mint_zh, marker)
        })
      }

      if (cancelled) return
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] })
      // Markers exist with their placeholder style now (see the comment on
      // `mapReady` above) — flip it so the restyle effect runs once more,
      // this time finding a real map, and applies whatever style current
      // props actually call for.
      setMapReady(true)
    }

    init()
    const pointMarkers = pointMarkersRef.current
    const pinMarkers = pinMarkersRef.current
    const compareMarkers = compareMarkersRef.current
    return () => {
      cancelled = true
      setMapReady(false)
      heatLayerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      pointMarkers.clear()
      pinMarkers.clear()
      compareMarkers.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitesForInit])

  // Keep Leaflet sized correctly when the sidebar/map split changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const id = window.setTimeout(() => map.invalidateSize(), 80)
    return () => window.clearTimeout(id)
  }, [viewMode, filterActiveForSites, modeForSites])

  useEffect(() => {
    function onResize() {
      mapRef.current?.invalidateSize()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={height !== '100%' ? { height } : undefined}
    />
  )
}
