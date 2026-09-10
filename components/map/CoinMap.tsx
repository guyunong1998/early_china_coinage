'use client'

/**
 * Base Leaflet map plotting a list of find sites as markers with popups;
 * supports fitting bounds to the sites and highlighting one site.
 *
 * Used by: app/search/page.tsx (search results map) and
 * app/sites/[site_code]/page.tsx (site detail page's own-site map).
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Layer } from 'leaflet'
import type { MapSite } from '@/lib/types'
import { dropPinHtml, PIN_HEIGHT, PIN_WIDTH } from '@/components/map/MapVisCanvas'
import { toEnglishName } from '@/lib/name-translation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  cityBoundaryStyle,
  countyBoundaryStyle,
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'

// --map-pin-accent (app/maps.css) — same token SinglePointMap.tsx/
// SiteMintOrigins.tsx use for their dropped pins, kept consistent across
// every "this map shows exactly one place" usage.
const SINGLE_POINT_PIN_COLOR = 'var(--map-pin-accent)'

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

type CoinMapProps = {
  sites: MapSite[]
  height?: string
  interactive?: boolean
  fitBounds?: boolean
  highlightSiteCode?: string
  /** Renders each marker as a dropped pin instead of the plain dot every
   * other (multi-site) map uses — for callers showing exactly one site's own
   * location (e.g. the site detail page), not search/browse results. */
  singlePin?: boolean
}

export default function CoinMap({
  sites,
  height = '480px',
  interactive = true,
  fitBounds = true,
  highlightSiteCode,
  singlePin = false,
}: CoinMapProps) {
  const { lang } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const labelLayersRef = useRef<{ labelsEn: Layer; labelsZh: Layer } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const leafletModule = await import('leaflet')
      // https://github.com/Leaflet/Leaflet.markercluster
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      if (cancelled || !containerRef.current || mapInstanceRef.current) return

      const L = leafletModule.default
      const { buildBaseLayers, addStaticMajorRivers, setLabelLayerForLang } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, {
        scrollWheelZoom: interactive,
        dragging: interactive,
        zoomControl: interactive,
        doubleClickZoom: interactive,
      }).setView([35.8, 105.4], 4)

      mapInstanceRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { cyclosm, labelsEn, labelsZh } = buildBaseLayers(L)
      cyclosm.addTo(map)
      labelLayersRef.current = { labelsEn, labelsZh }
      setLabelLayerForLang(map, labelsEn, labelsZh, lang)
      addStaticMajorRivers(L, map)

      const clusterGroup = (
        L as typeof L & {
          markerClusterGroup: (options?: {
            showCoverageOnHover?: boolean
            maxClusterRadius?: number
          }) => import('leaflet').LayerGroup
        }
      ).markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
      })

      const bounds: [number, number][] = []

      sites.forEach((site) => {
        if (site.lat == null || site.lng == null) return

        bounds.push([site.lat, site.lng])

        const isHighlighted = site.site_code === highlightSiteCode
        const size = isHighlighted ? 18 : 14
        const roleClass = isHighlighted ? 'map-dot-findspot-highlight' : 'map-dot-findspot'
        const marker = L.marker([site.lat, site.lng], {
          icon: singlePin
            ? L.divIcon({
                className: '',
                html: dropPinHtml(SINGLE_POINT_PIN_COLOR),
                iconSize: [PIN_WIDTH, PIN_HEIGHT],
                iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
              })
            : L.divIcon({
                className: '',
                html: `<div class="map-dot map-dot-size-${size} ${roleClass}"></div>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              }),
        })

        const nameZh = site.site_name_zh ?? '未命名遗址'
        const nameEn = toEnglishName(site.site_name_zh, site.site_name_en)
        const provinceZh = site.province_zh ?? '—'
        const provinceEn = toEnglishName(site.province_zh, site.province_en)
        const cityZh = site.city_zh ?? '—'
        const cityEn = toEnglishName(site.city_zh, site.city_en)
        const countyZh = site.county_zh ?? '—'
        const countyEn = toEnglishName(site.county_zh, site.county_en)
        const typeBilingual = formatCoinTypeBilingual(site.level2_types_zh)

        marker.bindPopup(`
          <div class="map-popup" style="min-width:250px">
            <div><strong>Site name / 遗址：</strong>${nameZh}${nameEn ? ` <span class="map-popup-muted-italic">${nameEn}</span>` : ''}</div>
            <div><strong>Province / 省：</strong>${provinceZh}${provinceEn ? ` <span class="map-popup-muted">(${provinceEn})</span>` : ''}</div>
            <div><strong>City / 市：</strong>${cityZh}${cityEn ? ` <span class="map-popup-muted">(${cityEn})</span>` : ''}</div>
            <div><strong>County / 县：</strong>${countyZh}${countyEn ? ` <span class="map-popup-muted">(${countyEn})</span>` : ''}</div>
            <div><strong>Coin type / 币类：</strong>${typeBilingual}</div>
            <div><strong>Quantity / 数量：</strong>${site.total_quantity_for_map ?? 0}</div>
            <a href="/sites/${site.site_code}" class="map-popup-link">View record →</a>
          </div>
        `)

        clusterGroup.addLayer(marker)
      })

      map.addLayer(clusterGroup)

      // If a site's city is known but county + specific location are unknown,
      // render the city administrative boundary in gray.
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
            L.geoJSON(geo as GeoJSON.GeoJsonObject, { style: cityBoundaryStyle() }).addTo(boundaryLayer)
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
        const countyLayer = L.layerGroup().addTo(map)
        await Promise.all(
          [...candidateCounties.values()].map(async ({ countyZh, cityZh, provinceZh }) => {
            const geo = await fetchCountyBoundaryGeoJson(countyZh, cityZh, provinceZh)
            if (!geo || cancelled) return
            L.geoJSON(geo as GeoJSON.GeoJsonObject, { style: countyBoundaryStyle() }).addTo(countyLayer)
          })
        )
      }

      if (cancelled) return
      if (fitBounds && bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] })
      } else if (highlightSiteCode) {
        const site = sites.find((s) => s.site_code === highlightSiteCode)
        if (site?.lat != null && site.lng != null) {
          map.setView([site.lat, site.lng], 10)
        }
      }
    }

    initMap()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
    // `lang` is deliberately omitted: the separate [lang] effect below swaps
    // the label layer without rebuilding the whole map on toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, interactive, fitBounds, highlightSiteCode, singlePin])

  // Swap the place-name label layer whenever the language toggle changes,
  // without rebuilding the whole map.
  useEffect(() => {
    const map = mapInstanceRef.current
    const layers = labelLayersRef.current
    if (!map || !layers) return
    import('@/lib/map-layers').then(({ setLabelLayerForLang }) => {
      setLabelLayerForLang(map, layers.labelsEn, layers.labelsZh, lang)
    })
  }, [lang])

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}
