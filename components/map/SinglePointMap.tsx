'use client'

/**
 * Generic single-marker map for one lat/lng point (configurable height/zoom).
 * The one marker is rendered as a dropped pin rather than the plain dot
 * every other map's markers use — since this map only ever shows exactly
 * one point, a pin reads immediately as "the location," not as one data
 * point among many.
 *
 * Used by: app/mints/[mint_code]/page.tsx (the mint town's own location) and
 * app/sites/[site_code]/page.tsx (the site's own location, via `boundarySite`
 * for sites whose location is only known to city/county precision).
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Layer } from 'leaflet'
import { dropPinHtml, PIN_HEIGHT, PIN_WIDTH } from '@/components/map/MapVisCanvas'
import {
  cityBoundaryStyle,
  countyBoundaryStyle,
  fetchCityBoundaryGeoJson,
  fetchCountyBoundaryGeoJson,
  shouldShowCityBoundary,
  shouldShowCountyBoundary,
} from '@/lib/city-boundaries'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { MapSite } from '@/lib/types'

// --map-pin-accent (app/maps.css) — the same hue .map-dot-single-point uses
// at 0.6 opacity, but a dropped pin is always fully opaque (see
// dropPinHtml's own doc comment).
const SINGLE_POINT_PIN_COLOR = 'var(--map-pin-accent)'

type SinglePointMapProps = {
  lat: number
  lng: number
  label: string
  height?: string
  zoom?: number
  /** When given, shades the city/county administrative boundary instead of
   * trusting the pin's exact placement — for a point only known to
   * city/county precision (see getSitePrecisionLevel in lib/city-boundaries).
   * Omitted by callers whose point is always exact (e.g. a mint town). */
  boundarySite?: MapSite
}

export default function SinglePointMap({
  lat,
  lng,
  label,
  height = '320px',
  zoom = 12,
  boundarySite,
}: SinglePointMapProps) {
  const { lang } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const labelLayersRef = useRef<{ labelsEn: Layer; labelsZh: Layer } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const { default: L } = await import('leaflet')
      if (cancelled || !containerRef.current || mapInstanceRef.current) return

      const { buildBaseLayers, addStaticMajorRivers, setLabelLayerForLang } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], zoom)
      mapInstanceRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { cyclosm, labelsEn, labelsZh } = buildBaseLayers(L)
      cyclosm.addTo(map)
      labelLayersRef.current = { labelsEn, labelsZh }
      setLabelLayerForLang(map, labelsEn, labelsZh, lang)
      addStaticMajorRivers(L, map)

      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: dropPinHtml(SINGLE_POINT_PIN_COLOR),
          iconSize: [PIN_WIDTH, PIN_HEIGHT],
          iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
        }),
      })
        .addTo(map)
        .bindPopup(`<strong>${label}</strong>`)
        .openPopup()

      // City/county precision (see lib/city-boundaries) — the pin above is
      // still dropped at the city/county centroid, but shading the admin
      // boundary signals the location isn't known any more precisely than
      // that. Mutually exclusive: getSitePrecisionLevel only ever resolves
      // to one of 'site' | 'county' | 'city' for a given site.
      if (boundarySite && shouldShowCityBoundary(boundarySite) && boundarySite.city_zh) {
        const geo = await fetchCityBoundaryGeoJson(boundarySite.city_zh, boundarySite.province_zh)
        if (geo && !cancelled) {
          L.geoJSON(geo as GeoJSON.GeoJsonObject, { style: cityBoundaryStyle() }).addTo(map)
        }
      } else if (boundarySite && shouldShowCountyBoundary(boundarySite) && boundarySite.county_zh) {
        const geo = await fetchCountyBoundaryGeoJson(
          boundarySite.county_zh,
          boundarySite.city_zh,
          boundarySite.province_zh
        )
        if (geo && !cancelled) {
          L.geoJSON(geo as GeoJSON.GeoJsonObject, { style: countyBoundaryStyle() }).addTo(map)
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
  }, [lat, lng, label, zoom, boundarySite])

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
