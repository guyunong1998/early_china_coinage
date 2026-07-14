'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import type { CoinType, HeatmapFind, MapSite } from '@/lib/types'
import { toEnglishName } from '@/lib/name-translation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { T } from '@/components/i18n/T'
import type { TFunction } from '@/lib/i18n/LanguageContext'
import {
  NO_DATA_ALPHA,
  NO_DATA_COLOR,
  ONE_OF_ONE_COLOR,
  PRESENT_UNQUANTIFIED_COLOR,
  RAMP_LEGEND_STOPS,
  hexToRgba,
  ratioToColor,
} from '@/lib/color-scale'
import {
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'

function dot(color: string, size = 14) {
  return `<div style="
    width:${size}px;height:${size}px;
    background:${color};
    border:2px solid ${color};
    border-radius:50%;
    box-shadow:0 1px 3px rgba(0,0,0,0.4);
  "></div>`
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

function buildPopupHtml(site: MapSite, statusLine: string | null, t: TFunction): string {
  const nameZh = site.site_name_zh ?? '未命名遗址'
  const nameEn = toEnglishName(site.site_name_zh, site.site_name_en)
  const provinceZh = site.province_zh ?? '—'
  const provinceEn = toEnglishName(site.province_zh, site.province_en)
  const cityZh = site.city_zh ?? '—'
  const cityEn = toEnglishName(site.city_zh, site.city_en)
  const countyZh = site.county_zh ?? '—'
  const countyEn = toEnglishName(site.county_zh, site.county_en)
  const typeBilingual = formatCoinTypeBilingual(site.major_types_zh)

  return `
    <div style="min-width:250px;font-size:12.5px;font-family:sans-serif;line-height:1.6">
      ${statusLine ? `<div>${statusLine}</div><hr style="margin:8px 0;border:none;border-top:1px solid #ddd" />` : ''}
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

function coalesceQuantity(find: HeatmapFind): number | null {
  if (find.quantity_total != null) return find.quantity_total
  if (find.quantity_estimated != null) return find.quantity_estimated
  if (find.quantity_min != null) return find.quantity_min
  return null
}

type SiteState =
  | { kind: 'no-filter' }
  | { kind: 'no-data' }
  | { kind: 'unquantified' }
  | { kind: 'one-of-one' }
  | { kind: 'ratio'; ratio: number; matchedQty: number; totalQty: number }

function stateColor(state: SiteState): string {
  switch (state.kind) {
    case 'no-filter':
      return '#006d71'
    case 'no-data':
      return hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA)
    case 'unquantified':
      return PRESENT_UNQUANTIFIED_COLOR
    case 'one-of-one':
      return ONE_OF_ONE_COLOR
    case 'ratio':
      return ratioToColor(state.ratio)
  }
}

function stateSize(state: SiteState): number {
  switch (state.kind) {
    case 'no-filter':
      return 12
    case 'no-data':
      return 10
    case 'unquantified':
    case 'one-of-one':
      return 13
    case 'ratio':
      return 10 + Math.round(state.ratio * 8)
  }
}

function statePopupLine(state: SiteState, t: TFunction): string | null {
  switch (state.kind) {
    case 'no-filter':
      return null
    case 'no-data':
      return t('heatmap.popup.noRecord')
    case 'unquantified':
      return t('heatmap.popup.presentNoCount')
    case 'one-of-one':
      return t('heatmap.popup.oneOfOne')
    case 'ratio':
      return t('heatmap.popup.ratio', {
        matched: state.matchedQty,
        total: state.totalQty,
        pct: Math.round(state.ratio * 100),
      })
  }
}

export function CoinTypeHeatmapMap({
  coinTypes,
  mapSites,
  finds,
}: {
  coinTypes: CoinType[]
  mapSites: MapSite[]
  finds: HeatmapFind[]
}) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())

  const [sel, setSel] = useState({ l1: '', l2: '', l3: '' })

  const l1Options = useMemo(
    () => [...new Set(coinTypes.map((c) => c.major_type_zh).filter((v): v is string => !!v))],
    [coinTypes]
  )
  const l2Options = useMemo(
    () =>
      sel.l1
        ? [
            ...new Set(
              coinTypes
                .filter((c) => c.major_type_zh === sel.l1)
                .map((c) => c.minor_type_zh)
                .filter((v): v is string => !!v)
            ),
          ]
        : [],
    [coinTypes, sel.l1]
  )
  const l3Options = useMemo(
    () =>
      sel.l1 && sel.l2
        ? [
            ...new Set(
              coinTypes
                .filter((c) => c.major_type_zh === sel.l1 && c.minor_type_zh === sel.l2)
                .map((c) => c.inscription)
                .filter((v): v is string => !!v)
            ),
          ]
        : [],
    [coinTypes, sel.l1, sel.l2]
  )

  const hasFilter = !!sel.l1

  const matchedCodes = useMemo(() => {
    if (!hasFilter) return null
    return new Set(
      coinTypes
        .filter(
          (c) =>
            c.major_type_zh === sel.l1 &&
            (!sel.l2 || c.minor_type_zh === sel.l2) &&
            (!sel.l3 || c.inscription === sel.l3)
        )
        .map((c) => c.coin_type_code)
    )
  }, [coinTypes, sel, hasFilter])

  const findsBySite = useMemo(() => {
    if (!matchedCodes) return null
    const map = new Map<string, HeatmapFind[]>()
    finds.forEach((f) => {
      if (!f.coin_type_code || !matchedCodes.has(f.coin_type_code)) return
      const list = map.get(f.site_code) ?? []
      list.push(f)
      map.set(f.site_code, list)
    })
    return map
  }, [matchedCodes, finds])

  const siteStates = useMemo(() => {
    if (!findsBySite) return null
    const result = new Map<string, SiteState>()
    mapSites.forEach((site) => {
      const matches = findsBySite.get(site.site_code) ?? []
      if (matches.length === 0) {
        result.set(site.site_code, { kind: 'no-data' })
        return
      }

      const quantified = matches.map(coalesceQuantity)
      const hasAnyQuantity = quantified.some((q) => q !== null)
      if (!hasAnyQuantity) {
        result.set(site.site_code, { kind: 'unquantified' })
        return
      }

      const matchedQty = quantified.reduce((sum: number, q) => sum + (q ?? 0), 0)
      const totalQty = site.total_quantity_for_map ?? 0

      if (totalQty === 1 && matchedQty === 1) {
        result.set(site.site_code, { kind: 'one-of-one' })
        return
      }

      const ratio = totalQty > 0 ? matchedQty / totalQty : matchedQty > 0 ? 1 : 0
      result.set(site.site_code, { kind: 'ratio', ratio, matchedQty, totalQty })
    })
    return result
  }, [findsBySite, mapSites])

  const foundInSummary = useMemo(() => {
    if (!siteStates) return null
    const foundCount = [...siteStates.values()].filter((s) => s.kind !== 'no-data').length
    return { foundCount, totalCount: mapSites.length }
  }, [siteStates, mapSites])

  // ── recolor markers when the selection changes ──
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach((marker, code) => {
        const state: SiteState = siteStates?.get(code) ?? { kind: 'no-filter' }
        const color = stateColor(state)
        const size = stateSize(state)

        marker.setIcon(
          L.divIcon({
            className: '',
            html: dot(color, size),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        )

        const site = mapSites.find((s) => s.site_code === code)
        if (!site) return
        marker.setPopupContent(buildPopupHtml(site, statePopupLine(state, t), t))
      })
    })
  }, [siteStates, mapSites, t])

  // ── initialise map once ──
  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, { zoomControl: true }).setView([35.8, 105.4], 4)
      mapRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      const bounds: [number, number][] = []

      mapSites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        const marker = L.marker([site.lat, site.lng], {
          icon: L.divIcon({ className: '', html: dot('#006d71', 12), iconSize: [12, 12], iconAnchor: [6, 6] }),
        })
          .addTo(map)
          .bindPopup(buildPopupHtml(site, null, t))

        markersRef.current.set(site.site_code, marker)
      })

      const candidateCities = new Map<string, { cityZh: string; provinceZh?: string | null }>()
      mapSites.forEach((site) => {
        if (!shouldShowCityBoundary(site) || !site.city_zh) return
        const key = `${site.province_zh ?? ''}::${site.city_zh}`
        if (!candidateCities.has(key)) candidateCities.set(key, { cityZh: site.city_zh, provinceZh: site.province_zh })
      })
      if (candidateCities.size > 0) {
        const layer = L.layerGroup().addTo(map)
        await Promise.all(
          [...candidateCities.values()].map(async ({ cityZh, provinceZh }) => {
            const geo = await fetchCityBoundaryGeoJson(cityZh, provinceZh)
            if (!geo || cancelled) return
            L.geoJSON(geo as GeoJSON.GeoJsonObject, {
              style: { color: '#8e8e8e', weight: 1.5, opacity: 0.9, fillColor: '#bfbfbf', fillOpacity: 0.1, dashArray: '4 4' },
            }).addTo(layer)
          })
        )
      }

      const candidateCounties = new Map<string, { countyZh: string; cityZh?: string | null; provinceZh?: string | null }>()
      mapSites.forEach((site) => {
        if (!shouldShowCountyBoundary(site) || !site.county_zh) return
        const key = `${site.province_zh ?? ''}::${site.city_zh ?? ''}::${site.county_zh}`
        if (!candidateCounties.has(key))
          candidateCounties.set(key, { countyZh: site.county_zh, cityZh: site.city_zh, provinceZh: site.province_zh })
      })
      if (candidateCounties.size > 0) {
        const layer = L.layerGroup().addTo(map)
        await Promise.all(
          [...candidateCounties.values()].map(async ({ countyZh, cityZh, provinceZh }) => {
            const geo = await fetchCountyBoundaryGeoJson(countyZh, cityZh, provinceZh)
            if (!geo || cancelled) return
            L.geoJSON(geo as GeoJSON.GeoJsonObject, {
              style: { color: '#6f6f6f', weight: 2, opacity: 0.9, fillColor: '#b5b5b5', fillOpacity: 0.14, dashArray: '2 3' },
            }).addTo(layer)
          })
        )
      }

      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] })
    }

    init()
    const markers = markersRef.current
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markers.clear()
    }
    // `t` is deliberately omitted: this effect only creates the map + markers
    // once, and the recolor effect (which does depend on `t`) re-applies
    // every marker's popup content whenever the language toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSites])

  return (
    <div className="overflow-hidden border border-brand/20">
      <div className="border-b border-brand/20 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sel.l1}
            placeholder={t('heatmap.select.category')}
            options={l1Options}
            onChange={(v) => setSel({ l1: v, l2: '', l3: '' })}
          />
          {sel.l1 && l2Options.length > 0 && (
            <Select
              value={sel.l2}
              placeholder={t('heatmap.select.subcategory')}
              options={l2Options}
              onChange={(v) => setSel((p) => ({ ...p, l2: v, l3: '' }))}
            />
          )}
          {sel.l2 && l3Options.length > 0 && (
            <Select
              value={sel.l3}
              placeholder={t('heatmap.select.inscription')}
              options={l3Options}
              onChange={(v) => setSel((p) => ({ ...p, l3: v }))}
            />
          )}
          {hasFilter && (
            <button
              onClick={() => setSel({ l1: '', l2: '', l3: '' })}
              className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-brand border border-gray-200 hover:border-brand"
            >
              <T k="heatmap.clearFilter" />
            </button>
          )}
        </div>

        {hasFilter && foundInSummary && (
          <p className="mt-2 text-sm text-gray-700">
            <T
              k="heatmap.foundIn"
              vars={{ found: foundInSummary.foundCount, total: foundInSummary.totalCount }}
            />
          </p>
        )}

        {hasFilter && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span className="font-semibold uppercase tracking-wide text-gray-500">
              <T k="heatmap.legend.title" />
            </span>
            {RAMP_LEGEND_STOPS.map((stop) => (
              <span key={stop.ratio} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: stop.color }} />
                {Math.round(stop.ratio * 100)}%
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: ONE_OF_ONE_COLOR }} />
              <T k="heatmap.legend.oneOfOne" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: PRESENT_UNQUANTIFIED_COLOR }} />
              <T k="heatmap.legend.presentNoCount" />
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA) }}
              />
              <T k="heatmap.legend.noData" />
            </span>
          </div>
        )}
      </div>

      <div ref={containerRef} style={{ height: '480px', width: '100%' }} />
    </div>
  )
}

function Select({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string
  placeholder: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
    >
      <option value="">{placeholder}</option>
      {options.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
    </select>
  )
}
