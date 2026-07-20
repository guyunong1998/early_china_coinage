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

import { useEffect, useRef } from 'react'
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

// The "filtered mint" highlight marker: a large square, brand-filled with a
// higher-opacity white border, visually distinct from the circular heatmap
// dots so the specific mint being filtered to stands out from the crowd of
// match-ratio points. Fully static (no continuous/computed values), so it's
// defined entirely in app/maps.css rather than inline like dot().
const MINT_HIGHLIGHT_SIZE = 30

function buildHighlightMintPopupHtml(mint: HighlightMint): string {
  return `
    <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:180px">
      <strong>Mint town / 铸币地：</strong>${mint.mint_zh}${mint.mint_en ? ` <span style="color:#888;font-style:italic">(${mint.mint_en})</span>` : ''}<br/>
      ${mint.modern_location_en ? `${mint.modern_location_en}<br/>` : ''}
      ${mint.mint_code ? `<a href="/mints/${mint.mint_code}" style="color:#006d71">View mint town →</a>` : ''}
    </div>
  `
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
 * state — the one piece of restyle logic shared by both sites and mints. */
function applyHeatMarkerStyle(
  L: typeof import('leaflet'),
  marker: Marker,
  rawState: SiteHeatState | undefined,
  totalQty: number,
  maxQty: number,
  sizeRange: { min: number; max: number },
  pointOpacity: number,
  inDensity: boolean,
  popupHtml: string
) {
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

  marker.setIcon(
    L.divIcon({
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

export type HighlightMint = {
  mint_zh: string
  mint_en: string | null
  mint_code: string | null
  modern_location_en: string | null
  lat: number
  lng: number
}

type SitesCanvasProps = {
  kind: 'sites'
  sites: MapSite[]
  mode: FilterMode
  siteStates: Map<string, SiteHeatState> | null
  viewMode: ViewMode
  densityLatLngs: [number, number, number][]
  filterActive: boolean
  /** Extra distinct point for the mint the active filter resolves to (Find
   * Site's "by mint" filter mode), when it has known coordinates. */
  highlightMint?: HighlightMint | null
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
  /** Extra distinct point for the mint the active coin-type filter resolves
   * to (e.g. a specific inscription), when it has known coordinates. */
  highlightMint?: HighlightMint | null
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
  const highlightMarkerRef = useRef<Marker | null>(null)
  const heatLayerRef = useRef<HeatLayer | null>(null)

  // Kind-specific fields, pulled out of the discriminated union once so effect
  // dependency arrays below stay simple, statically-checkable expressions.
  const statesForRestyle = props.kind === 'sites' ? props.siteStates : props.mintStates
  const sitesForRestyle = props.kind === 'sites' ? props.sites : null
  const modeForSites = props.kind === 'sites' ? props.mode : null
  const filterActiveForSites = props.kind === 'sites' ? props.filterActive : null
  const sitesForInit = props.kind === 'sites' ? props.sites : null
  const highlightMint = props.highlightMint ?? null

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
            buildPopupHtml(site, toDisplayState(rawState ?? { kind: 'no-filter' }, totalQty), t)
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
            buildMintPopupHtml(mint, toDisplayState(rawState ?? { kind: 'no-filter' }, mint.totalQty), t)
          )
        })
      }

      // Extra highlight point for the mint the active filter resolves to
      // (Find Site's "by mint" mode, or Mint Town's inscription filter) —
      // shared by both kinds, shown on top with its popup open by default.
      if (highlightMint) {
        const popupHtml = buildHighlightMintPopupHtml(highlightMint)
        if (!highlightMarkerRef.current) {
          highlightMarkerRef.current = L.marker([highlightMint.lat, highlightMint.lng], {
            icon: L.divIcon({
              className: '',
              html: '<div class="map-mint-highlight"></div>',
              iconSize: [MINT_HIGHLIGHT_SIZE, MINT_HIGHLIGHT_SIZE],
              iconAnchor: [MINT_HIGHLIGHT_SIZE / 2, MINT_HIGHLIGHT_SIZE / 2],
            }),
            zIndexOffset: 1000,
          })
            .addTo(map)
            .bindPopup(popupHtml)
        } else {
          highlightMarkerRef.current.setLatLng([highlightMint.lat, highlightMint.lng])
          highlightMarkerRef.current.setPopupContent(popupHtml)
        }
        highlightMarkerRef.current.openPopup()
      } else if (highlightMarkerRef.current) {
        map.removeLayer(highlightMarkerRef.current)
        highlightMarkerRef.current = null
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
  }, [statesForRestyle, sitesForRestyle, modeForSites, highlightMint, t, viewMode, densityLatLngs])

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

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)

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
        addLayerControl(L, map, osm, satellite, satelliteLabels, {
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

      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] })
    }

    init()
    const pointMarkers = pointMarkersRef.current
    return () => {
      cancelled = true
      heatLayerRef.current = null
      highlightMarkerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      pointMarkers.clear()
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
