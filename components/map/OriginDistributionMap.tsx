'use client'

/**
 * Pure map for a one-to-many relationship: one origin point plus a dashed
 * line to each of many destination points, both ends drawn in the same
 * caller-chosen color. Two directions share this exact shape today — a mint
 * town's own location plus the find sites where its coins turned up
 * (MintIssueDistribution.tsx), and a find site's own location plus the mint
 * towns its coins were issued from (SiteMintOrigins.tsx) — only the data and
 * popup content differ, so callers build `origin`/`destinations` and their
 * popup HTML themselves. No filter UI, no caption, no wrapper — just the map.
 *
 * Used by: components/mints/MintIssueDistribution.tsx
 * (app/mints/[mint_code]/page.tsx) and components/site/SiteMintOrigins.tsx
 * (app/sites/[site_code]/page.tsx).
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Layer } from 'leaflet'
import { dropPinHtml, PIN_HEIGHT, PIN_WIDTH } from '@/components/map/MapVisCanvas'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type OriginDistributionPoint = {
  key: string
  lat: number
  lng: number
  popupHtml: string
  /** Origin only — opens its popup on load instead of waiting for a click
   * (e.g. so a site's own map identifies itself immediately). */
  openPopup?: boolean
}

type OriginDistributionMapProps = {
  /** Which direction this map is showing — not used yet (both directions
   * render identically), reserved for future direction-specific behavior. */
  kind: 'mint' | 'site'
  /** Shared color for the origin pin, every destination dot, and the
   * connector lines between them. */
  color: string
  /** null when the origin's own location isn't established yet — the map
   * still renders, just without an origin pin/connector lines, centered on
   * whatever destinations are available. */
  origin: OriginDistributionPoint | null
  destinations: OriginDistributionPoint[]
  /** @default 12 */
  dotSize?: number
}

// Leaflet's vector layers (the dashed connector lines) can't take a CSS
// class, so the line color still needs a real value — the same
// --map-dot-special token used elsewhere for this kind of "just one relation
// on screen at a time" connector line.
const CONNECTOR_LINE_COLOR = 'var(--map-dot-special)'

function makeDotHtml(color: string, size: number) {
  return `<div class="map-dot map-dot-size-${size}" style="background:${color}"></div>`
}

export function OriginDistributionMap({
  color,
  origin,
  destinations,
  dotSize = 12,
}: OriginDistributionMapProps) {
  const { lang } = useLanguage()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const labelLayersRef = useRef<{ labelsEn: Layer; labelsZh: Layer } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { default: L } = await import('leaflet')
      const { buildBaseLayers, addStaticMajorRivers, setLabelLayerForLang } = await import('@/lib/map-layers')
      if (cancelled || !containerRef.current) return

      mapRef.current?.remove()
      const firstDestination = destinations[0]
      const initialCenter: [number, number] = origin
        ? [origin.lat, origin.lng]
        : firstDestination
          ? [firstDestination.lat, firstDestination.lng]
          : [35, 105]
      const map = L.map(containerRef.current).setView(initialCenter, 6)
      mapRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { cyclosm, labelsEn, labelsZh } = buildBaseLayers(L)
      cyclosm.addTo(map)
      labelLayersRef.current = { labelsEn, labelsZh }
      setLabelLayerForLang(map, labelsEn, labelsZh, lang)
      addStaticMajorRivers(L, map)

      const bounds: [number, number][] = origin ? [[origin.lat, origin.lng]] : []

      // Origin marker — a dropped pin, since this map only ever shows
      // exactly one origin (see dropPinHtml's own doc comment). Drawn above
      // every destination dot (zIndexOffset) and skipped entirely when the
      // origin's own location isn't established.
      if (origin) {
        const marker = L.marker([origin.lat, origin.lng], {
          icon: L.divIcon({
            className: '',
            html: dropPinHtml(color),
            iconSize: [PIN_WIDTH, PIN_HEIGHT],
            iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
            popupAnchor: [0, -PIN_HEIGHT],
          }),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup(origin.popupHtml)
        if (origin.openPopup) marker.openPopup()
      }

      destinations.forEach((destination) => {
        bounds.push([destination.lat, destination.lng])

        if (origin) {
          L.polyline(
            [
              [origin.lat, origin.lng],
              [destination.lat, destination.lng],
            ],
            { color: CONNECTOR_LINE_COLOR, weight: 1.5, opacity: 0.55, dashArray: '4 5' }
          ).addTo(map)
        }

        L.marker([destination.lat, destination.lng], {
          icon: L.divIcon({
            className: '',
            html: makeDotHtml(color, dotSize),
            iconSize: [dotSize, dotSize],
            iconAnchor: [dotSize / 2, dotSize / 2],
          }),
        })
          .addTo(map)
          .bindPopup(destination.popupHtml)
      })

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] })
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 6)
      }
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // `lang` is deliberately omitted: the separate [lang] effect below swaps
    // the label layer without rebuilding the whole map on toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destinations, color, dotSize])

  // Swap the place-name label layer whenever the language toggle changes,
  // without rebuilding the whole map.
  useEffect(() => {
    const map = mapRef.current
    const layers = labelLayersRef.current
    if (!map || !layers) return
    import('@/lib/map-layers').then(({ setLabelLayerForLang }) => {
      setLabelLayerForLang(map, layers.labelsEn, layers.labelsZh, lang)
    })
  }, [lang])

  return <div ref={containerRef} className="h-[360px] w-full" />
}
