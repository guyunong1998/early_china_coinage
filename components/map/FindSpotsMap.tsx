'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import { TypologyFilterBar } from '@/components/map/TypologyFilterBar'
import { T } from '@/components/i18n/T'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TFunction } from '@/lib/i18n/LanguageContext'
import {
  NO_DATA_ALPHA,
  NO_DATA_COLOR,
  PRESENT_UNQUANTIFIED_COLOR,
  PURE_MATCH_COLOR,
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
import { computeSiteHeatStates, type SiteHeatState } from '@/lib/context-heatmap'
import {
  buildMintFilterOptions,
  formatMintOptionLabel,
  getMatchingCoinTypeCodesByMint,
} from '@/lib/mint-filter'
import { toEnglishName } from '@/lib/name-translation'
import {
  emptyTypologySelection,
  getMatchingCoinTypeCodes,
  hasTypologyFilter,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import type { CoinType, HeatmapFind, MapSite } from '@/lib/types'

type FilterMode = 'type' | 'mint'

function dot(color: string, size = 14) {
  return `<div style="
    width:${size}px;height:${size}px;
    background:${color};
    border:2px solid ${color.includes('rgba') ? 'rgba(80,80,80,0.35)' : color};
    border-radius:50%;
    box-shadow:0 1px 3px rgba(0,0,0,0.35);
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

function stateColor(state: SiteHeatState): string {
  switch (state.kind) {
    case 'no-filter':
      return '#365727'
    case 'no-data':
      return hexToRgba(NO_DATA_COLOR, NO_DATA_ALPHA)
    case 'unquantified':
      return PRESENT_UNQUANTIFIED_COLOR
    case 'pure':
      return PURE_MATCH_COLOR
    case 'ratio':
      return ratioToColor(state.ratio)
  }
}

function stateSize(state: SiteHeatState): number {
  switch (state.kind) {
    case 'no-filter':
      return 12
    case 'no-data':
      return 9
    case 'unquantified':
      return 12
    case 'pure':
      return 14
    case 'ratio':
      return 11 + Math.round(state.ratio * 5)
  }
}

function statePopupLine(state: SiteHeatState, mode: FilterMode, t: TFunction): string | null {
  switch (state.kind) {
    case 'no-filter':
      return null
    case 'no-data':
      return t('heatmap.popup.noRecord')
    case 'unquantified':
      return t('heatmap.popup.presentNoCount')
    case 'pure':
      return t(mode === 'mint' ? 'map.popup.pureMint' : 'map.popup.pureContext')
    case 'ratio':
      return t('heatmap.popup.ratio', {
        matched: state.matchedQty,
        total: state.totalQty,
        pct: Math.round(state.ratio * 100),
      })
  }
}

export function FindSpotsMap({
  sites,
  coinTypes,
  finds,
  height = '100%',
}: {
  sites: MapSite[]
  coinTypes: CoinType[]
  finds: HeatmapFind[]
  height?: string
}) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())

  const [mode, setMode] = useState<FilterMode>('type')
  const [sel, setSel] = useState<TypologyFilterSelection>(emptyTypologySelection())
  const [mintFilter, setMintFilter] = useState('')
  const [mintSearch, setMintSearch] = useState('')

  const mintOptions = useMemo(() => buildMintFilterOptions(coinTypes), [coinTypes])
  const filteredMints = useMemo(() => {
    const q = mintSearch.trim().toLowerCase()
    if (!q) return mintOptions
    return mintOptions.filter(
      (m) =>
        m.mint_zh.includes(mintSearch.trim()) ||
        (m.mint_en ?? '').toLowerCase().includes(q) ||
        (m.state_zh ?? '').includes(mintSearch.trim()) ||
        (m.state_en ?? '').toLowerCase().includes(q)
    )
  }, [mintOptions, mintSearch])

  const filterActive = mode === 'type' ? hasTypologyFilter(sel) : !!mintFilter

  const matchedCodes = useMemo(() => {
    if (mode === 'mint') return getMatchingCoinTypeCodesByMint(coinTypes, mintFilter)
    return getMatchingCoinTypeCodes(coinTypes, sel)
  }, [mode, coinTypes, mintFilter, sel])

  const siteStates = useMemo(
    () =>
      computeSiteHeatStates(
        sites.map((s) => s.site_code),
        finds,
        matchedCodes
      ),
    [sites, finds, matchedCodes]
  )

  const foundInSummary = useMemo(() => {
    if (!siteStates) return null
    const foundCount = [...siteStates.values()].filter((s) => s.kind !== 'no-data').length
    return { foundCount, totalCount: sites.length }
  }, [siteStates, sites])

  function clearFilters() {
    setSel(emptyTypologySelection())
    setMintFilter('')
    setMintSearch('')
  }

  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach((marker, code) => {
        const state: SiteHeatState = siteStates?.get(code) ?? { kind: 'no-filter' }
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
        marker.setZIndexOffset(
          state.kind === 'no-data' ? -1000 : state.kind === 'pure' || state.kind === 'ratio' ? 500 : 0
        )

        const site = sites.find((s) => s.site_code === code)
        if (!site) return
        marker.setPopupContent(buildPopupHtml(site, statePopupLine(state, mode, t), t))
      })
    })
  }, [siteStates, sites, mode, t])

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

      sites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        const marker = L.marker([site.lat, site.lng], {
          icon: L.divIcon({
            className: '',
            html: dot('#365727', 12),
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        })
          .addTo(map)
          .bindPopup(buildPopupHtml(site, null, t))

        markersRef.current.set(site.site_code, marker)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-brand/20 bg-white">
      <div className="shrink-0 border-b border-brand/20 px-4 py-3">
        <p className="mb-2 text-xs text-gray-600">
          <T k="map.filter.hint" />
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-0">
          {(['type', 'mint'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                clearFilters()
              }}
              className={`px-4 py-1.5 text-xs font-semibold border transition ${
                mode === m
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
              }`}
            >
              <T k={m === 'type' ? 'map.filter.byType' : 'map.filter.byMint'} />
            </button>
          ))}
          {filterActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-brand border border-gray-200 hover:border-brand"
            >
              <T k="heatmap.clearFilter" />
            </button>
          )}
        </div>

        {mode === 'type' && (
          <TypologyFilterBar sel={sel} onChange={setSel} showInscriptionList />
        )}

        {mode === 'mint' && (
          <div className="flex flex-wrap gap-2 text-sm">
            <input
              type="search"
              placeholder={t('map.filter.searchMint')}
              value={mintSearch}
              onChange={(e) => setMintSearch(e.target.value)}
              className="rounded border border-brand/30 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <select
              value={mintFilter}
              onChange={(e) => setMintFilter(e.target.value)}
              className="min-w-[14rem] rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
            >
              <option value="">{t('map.filter.selectMint')}</option>
              {filteredMints.map((m) => (
                <option key={m.mint_zh} value={m.mint_zh}>
                  {formatMintOptionLabel(m)}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterActive && foundInSummary && (
          <p className="mt-2 text-sm text-gray-700">
            <T
              k="heatmap.foundIn"
              vars={{ found: foundInSummary.foundCount, total: foundInSummary.totalCount }}
            />
          </p>
        )}

        {filterActive && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span className="font-semibold uppercase tracking-wide text-gray-500">
              <T k="map.legend.title" />
            </span>
            {RAMP_LEGEND_STOPS.map((stop) => (
              <span key={stop.ratio} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: stop.color }} />
                {Math.round(stop.ratio * 100)}%
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: PURE_MATCH_COLOR }} />
              <T k={mode === 'mint' ? 'map.legend.pureMint' : 'map.legend.pure'} />
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: PRESENT_UNQUANTIFIED_COLOR }}
              />
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

      <div ref={containerRef} className="min-h-0 flex-1" style={{ height, width: '100%' }} />
    </div>
  )
}
