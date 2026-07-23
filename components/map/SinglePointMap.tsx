'use client'

/**
 * Generic single-marker map for one lat/lng point (configurable height/zoom).
 * The one marker is rendered as a dropped pin rather than the plain dot
 * every other map's markers use — since this map only ever shows exactly
 * one point, a pin reads immediately as "the location," not as one data
 * point among many.
 *
 * Used by: app/mints/[mint_code]/page.tsx (the mint town's own location).
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { dropPinHtml, PIN_HEIGHT, PIN_WIDTH } from '@/components/map/MapVisCanvas'

// Solid form of --accent-rgb (app/globals.css) — the same hue
// .map-dot-single-point used at 0.6 opacity, but a dropped pin is always
// fully opaque (see dropPinHtml's own doc comment).
const SINGLE_POINT_PIN_COLOR = '#e1941f'

type SinglePointMapProps = {
  lat: number
  lng: number
  label: string
  height?: string
  zoom?: number
}

export default function SinglePointMap({
  lat,
  lng,
  label,
  height = '320px',
  zoom = 12,
}: SinglePointMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const { default: L } = await import('leaflet')
      if (cancelled || !containerRef.current || mapInstanceRef.current) return

      const { buildBaseLayers, addStaticMajorRivers } = await import('@/lib/map-layers')

      const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], zoom)
      mapInstanceRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { cyclosm, satelliteLabels } = buildBaseLayers(L)
      cyclosm.addTo(map)
      satelliteLabels.addTo(map)
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
    }

    initMap()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [lat, lng, label, zoom])

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}
