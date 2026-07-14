'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import { ALL_MINTS } from '@/lib/typology-data'
import type { MapSite } from '@/lib/types'
import { TypologyFilterBar } from '@/components/map/TypologyFilterBar'
import {
  emptyTypologySelection,
  siteMatchesTypologyFilter,
  type TypologyFilterSelection,
} from '@/lib/typology-filter'
import { toEnglishName } from '@/lib/name-translation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { T } from '@/components/i18n/T'
import {
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'

// ─── helpers ───────────────────────────────────────────────────────────────

function dot(color: string, size = 12) {
  return `<div style="
    width:${size}px;height:${size}px;
    background:${color};
    border:2px solid white;
    border-radius:50%;
    box-shadow:0 1px 3px rgba(0,0,0,0.4);
  "></div>`
}

function csvIncludes(csv: string | null | undefined, value: string) {
  if (!csv) return false
  return csv.split('、').concat(csv.split(',')).some((v) => v.trim() === value)
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

// ─── types ─────────────────────────────────────────────────────────────────

type FilterMode = 'type' | 'mint'

// ─── main component ────────────────────────────────────────────────────────

export function CoinFilterMap({ sites }: { sites: MapSite[] }) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())

  const [mode, setMode] = useState<FilterMode>('type')
  const [tf, setTf] = useState<TypologyFilterSelection>(emptyTypologySelection())
  const [mintFilter, setMintFilter] = useState('')
  const [mintSearch, setMintSearch] = useState('')
  const [matchCount, setMatchCount] = useState<number | null>(null)

  const filteredMints = mintSearch
    ? ALL_MINTS.filter(
        (m) =>
          m.mint_zh.includes(mintSearch) ||
          (m.mint_en ?? '').toLowerCase().includes(mintSearch.toLowerCase())
      )
    : ALL_MINTS

  // ── compute matching site codes ──
  function computeMatches(): Set<string> | null {
    if (mode === 'type') {
      if (!tf.l1) return null
      const matched = new Set<string>()
      sites.forEach((s) => {
        if (siteMatchesTypologyFilter(s, tf)) matched.add(s.site_code)
      })
      return matched
    } else {
      if (!mintFilter) return null
      const matched = new Set<string>()
      sites.forEach((s) => {
        if (csvIncludes(s.mints_zh, mintFilter)) matched.add(s.site_code)
      })
      return matched
    }
  }

  // ── update marker colours when filter changes ──
  useEffect(() => {
    const matches = computeMatches()
    setMatchCount(matches ? matches.size : null)

    if (!mapRef.current) return

    // We need L at runtime to create DivIcons properly
    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach((marker, code) => {
        const isMatch = matches ? matches.has(code) : null
        const color = isMatch === null ? '#006d71' : isMatch ? '#c0392b' : '#b0b8b8'
        const size = isMatch === true ? 14 : isMatch === false ? 10 : 12

        marker.setIcon(
          L.divIcon({
            className: '',
            html: dot(color, size),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        )
        // Bring matched markers to the front, push non-matches behind
        marker.setZIndexOffset(isMatch === true ? 1000 : isMatch === false ? -1000 : 0)
      })
    })
  }, [tf, mintFilter, mode, sites])

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

      sites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        const icon = L.divIcon({
          className: '',
          html: dot('#006d71', 12),
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        const nameZh = site.site_name_zh ?? '未命名遗址'
        const nameEn = toEnglishName(site.site_name_zh, site.site_name_en)
        const provinceZh = site.province_zh ?? '—'
        const provinceEn = toEnglishName(site.province_zh, site.province_en)
        const cityZh = site.city_zh ?? '—'
        const cityEn = toEnglishName(site.city_zh, site.city_en)
        const countyZh = site.county_zh ?? '—'
        const countyEn = toEnglishName(site.county_zh, site.county_en)
        const typeBilingual = formatCoinTypeBilingual(site.major_types_zh)

        const marker = L.marker([site.lat, site.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:250px;font-size:12.5px;font-family:sans-serif;line-height:1.6">
              <div><strong>Site name / 遗址：</strong>${nameZh}${nameEn ? ` <span style="color:#888;font-style:italic">${nameEn}</span>` : ''}</div>
              <div><strong>Province / 省：</strong>${provinceZh}${provinceEn ? ` <span style="color:#888">(${provinceEn})</span>` : ''}</div>
              <div><strong>City / 市：</strong>${cityZh}${cityEn ? ` <span style="color:#888">(${cityEn})</span>` : ''}</div>
              <div><strong>County / 县：</strong>${countyZh}${countyEn ? ` <span style="color:#888">(${countyEn})</span>` : ''}</div>
              <div><strong>Coin type / 币类：</strong>${typeBilingual}</div>
              <div><strong>Quantity / 数量：</strong>${site.total_quantity_for_map ?? 0}</div>
              <a href="/sites/${site.site_code}" style="color:#006d71;font-size:12px">${t('search.viewRecord')}</a>
            </div>`
          )

        markersRef.current.set(site.site_code, marker)
      })

      // Gray city boundaries for uncertain site locations
      const candidateCities = new Map<string, { cityZh: string; provinceZh?: string | null }>()
      sites.forEach((site) => {
        if (!shouldShowCityBoundary(site) || !site.city_zh) return
        const key = `${site.province_zh ?? ''}::${site.city_zh}`
        if (!candidateCities.has(key)) {
          candidateCities.set(key, { cityZh: site.city_zh, provinceZh: site.province_zh })
        }
      })

      if (candidateCities.size > 0) {
        const boundaryLayer = L.layerGroup().addTo(map)
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
            }).addTo(boundaryLayer)
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
        const countyLayer = L.layerGroup().addTo(map)
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
            }).addTo(countyLayer)
          })
        )
      }

      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] })
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
    // `t` is deliberately omitted: re-running this would refetch every boundary
    // geometry just to relabel a popup link, so it reflects the language active
    // at mount/navigation rather than updating live on toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites])

  const activeFilter = mode === 'type' ? tf.l1 : mintFilter

  return (
    <div className="panel overflow-hidden">
      {/* ── filter panel ── */}
      <div className="border-b border-brand/20 bg-white px-4 py-3">
        {/* Mode tabs */}
        <div className="mb-3 flex gap-0">
          {(['type', 'mint'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setTf(emptyTypologySelection())
                setMintFilter('')
              }}
              className={`px-4 py-1.5 text-xs font-semibold border transition ${
                mode === m
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-brand border-brand/30 hover:bg-brand-light'
              }`}
            >
              <T k={m === 'type' ? 'coinFilterMap.byType' : 'coinFilterMap.byMint'} />
            </button>
          ))}
          {activeFilter && (
            <button
              onClick={() => {
                setTf(emptyTypologySelection())
                setMintFilter('')
              }}
              className="ml-auto px-3 py-1.5 text-xs text-gray-500 hover:text-brand border border-gray-200 hover:border-brand"
            >
              <T k="coinFilterMap.clearFilter" />
            </button>
          )}
        </div>

        {/* Type cascade */}
        {mode === 'type' && (
          <TypologyFilterBar sel={tf} onChange={setTf} showInscriptionList compact />
        )}

        {/* Mint search */}
        {mode === 'mint' && (
          <div className="flex flex-wrap gap-2 text-sm">
            <input
              type="search"
              placeholder={t('coinFilterMap.searchMint')}
              value={mintSearch}
              onChange={(e) => setMintSearch(e.target.value)}
              className="rounded border border-brand/30 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <Select
              value={mintFilter}
              placeholder={t('coinFilterMap.selectMint')}
              options={filteredMints.map(
                (m) => `${m.mint_zh}${m.mint_en ? ' (' + m.mint_en + ')' : ''}${m.state_zh ? ' — ' + m.state_zh : ''}`
              )}
              optionValues={filteredMints.map((m) => m.mint_zh)}
              onChange={(v) => setMintFilter(v)}
            />
          </div>
        )}

        {/* Legend */}
        {activeFilter && (
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-[#c0392b]" />
              <T k="coinFilterMap.match" />
              {matchCount !== null && (
                <strong className="ml-1 text-brand">
                  {t('coinFilterMap.matchSites', { count: matchCount })}
                </strong>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-[#b0b8b8]" />
              <T k="coinFilterMap.noMatch" />
            </span>
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={containerRef} style={{ height: '420px', width: '100%' }} />
    </div>
  )
}

// ─── small reusable select ─────────────────────────────────────────────────

function Select({
  value,
  placeholder,
  options,
  optionValues,
  onChange,
}: {
  value: string
  placeholder: string
  options: string[]
  optionValues?: string[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
    >
      <option value="">{placeholder}</option>
      {options.map((label, i) => (
        <option key={i} value={optionValues ? optionValues[i] : label}>
          {label}
        </option>
      ))}
    </select>
  )
}
