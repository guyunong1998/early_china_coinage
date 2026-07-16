'use client'

/**
 * Base Leaflet map plotting a list of find sites as markers with popups;
 * supports fitting bounds to the sites and highlighting one site.
 *
 * Not used directly by any page — wrapped by CoinMapSection.tsx.
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { MapSite } from '@/lib/types'
import { toEnglishName } from '@/lib/name-translation'
import {
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'

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
}

export default function CoinMap({
  sites,
  height = '480px',
  interactive = true,
  fitBounds = true,
  highlightSiteCode,
}: CoinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const leafletModule = await import('leaflet')
      await import('leaflet.markercluster')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

      if (cancelled || !containerRef.current || mapInstanceRef.current) return

      const L = leafletModule.default
      const { buildBaseLayers, addLayerControl } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, {
        scrollWheelZoom: interactive,
        dragging: interactive,
        zoomControl: interactive,
        doubleClickZoom: interactive,
      }).setView([35.8, 105.4], 4)

      mapInstanceRef.current = map

      const { osm, satellite, satelliteLabels } = buildBaseLayers(L)
      osm.addTo(map)

      if (interactive) {
        addLayerControl(L, map, osm, satellite, satelliteLabels)
      }

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
          icon: L.divIcon({
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
        const typeBilingual = formatCoinTypeBilingual(site.major_types_zh)

        marker.bindPopup(`
          <div style="min-width:250px;font-family:sans-serif;font-size:12.5px;line-height:1.6">
            <div><strong>Site name / 遗址：</strong>${nameZh}${nameEn ? ` <span style="color:#888;font-style:italic">${nameEn}</span>` : ''}</div>
            <div><strong>Province / 省：</strong>${provinceZh}${provinceEn ? ` <span style="color:#888">(${provinceEn})</span>` : ''}</div>
            <div><strong>City / 市：</strong>${cityZh}${cityEn ? ` <span style="color:#888">(${cityEn})</span>` : ''}</div>
            <div><strong>County / 县：</strong>${countyZh}${countyEn ? ` <span style="color:#888">(${countyEn})</span>` : ''}</div>
            <div><strong>Coin type / 币类：</strong>${typeBilingual}</div>
            <div><strong>Quantity / 数量：</strong>${site.total_quantity_for_map ?? 0}</div>
            <a href="/sites/${site.site_code}" style="color:#006d71;font-size:12px">View record →</a>
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
  }, [sites, interactive, fitBounds, highlightSiteCode])

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}
