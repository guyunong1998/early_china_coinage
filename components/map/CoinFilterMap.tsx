'use client'

/**
 * Pure map: every find site as a clickable marker on the homepage, plus a
 * density heatmap overlay (by quantity) shown by default. No filters, no
 * header, no wrapper — just the map.
 *
 * Used by: app/page.tsx (homepage), which wraps it with the header link out
 * to the full map visualizations page.
 */

import { useEffect, useRef } from 'react'
import type { HeatLayer, Map as LeafletMap, Marker } from 'leaflet'
import type { MapSite } from '@/lib/types'
import { toEnglishName } from '@/lib/name-translation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'

// ─── helpers ───────────────────────────────────────────────────────────────

// Marker look (size + role color) comes from app/maps.css — `.map-dot`,
// `.map-dot-size-12`, `.map-dot-home-site` — no inline styles.
function dot(size = 12) {
  return `<div class="map-dot map-dot-size-${size} map-dot-home-site"></div>`
}

/** Same intensity curve as the "no filter" state on the find spots map, so
 * both density overlays read consistently. */
function densityIntensity(qty: number | null | undefined): number {
  if (!qty || qty <= 0) return 0.35
  return Math.min(1, 0.35 + Math.log10(qty + 1) / 4)
}

const DENSITY_GRADIENT: Record<number, string> = {
  0.15: '#f0d56a',
  0.4: '#e39a2b',
  0.65: '#d04a1c',
  0.85: '#a01515',
  1: '#6e0c0c',
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

// ─── main component ────────────────────────────────────────────────────────

export function CoinFilterMap({ sites }: { sites: MapSite[] }) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const heatLayerRef = useRef<HeatLayer | null>(null)

  // ── initialise map once ──
  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current || mapRef.current) return

      // Ensure leaflet.heat attaches to this Leaflet instance
      const g = globalThis as typeof globalThis & { L?: typeof L }
      g.L = L
      await import('leaflet.heat')

      const map = L.map(containerRef.current, { zoomControl: true }).setView([35.8, 105.4], 4)
      mapRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)
      addLayerControl(L, map, osm, satellite, satelliteLabels)

      const bounds: [number, number][] = []
      const densityLatLngs: [number, number, number][] = []

      sites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        const icon = L.divIcon({
          className: '',
          html: dot(12),
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
        densityLatLngs.push([site.lat, site.lng, densityIntensity(site.total_quantity_for_map)])
      })

      if (densityLatLngs.length > 0) {
        heatLayerRef.current = L.heatLayer(densityLatLngs, {
          radius: 32,
          blur: 26,
          maxZoom: 9,
          max: 1,
          minOpacity: 0.25,
          gradient: DENSITY_GRADIENT,
        }).addTo(map)
      }

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
    const markers = markersRef.current
    return () => {
      cancelled = true
      heatLayerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      markers.clear()
    }
    // `t` is deliberately omitted: re-running this would refetch every boundary
    // geometry just to relabel a popup link, so it reflects the language active
    // at mount/navigation rather than updating live on toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites])

  return <div ref={containerRef} style={{ height: '420px', width: '100%' }} />
}
