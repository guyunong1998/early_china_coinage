'use client'

/**
 * Pure map: the mint town's own location plus the (already-filtered) find
 * sites where coins issued from it were discovered. No filter UI, no
 * caption, no wrapper — just the map.
 *
 * Used by: components/mints/MintIssueDistribution.tsx
 * (app/mints/[mint_code]/page.tsx), which owns the coin-type filter that
 * decides which sites to pass in.
 */

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Layer } from 'leaflet'
import { dropPinHtml, PIN_HEIGHT, PIN_WIDTH } from '@/components/map/MapVisCanvas'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { MapSite } from '@/lib/types'

type MintIssueDistributionMapCanvasProps = {
  mint: {
    name_zh: string
    name_en: string
    lat: number
    lng: number
  }
  sites: MapSite[]
}

// Findspot marker look comes from app/maps.css's `.map-dot-mint-issue-site`
// — no inline styles.
function makeDot(role: string, size: number) {
  return `<div class="map-dot map-dot-size-${size} ${role}"></div>`
}

// Same yellow used for ratioToColor's low-end ramp stop (lib/color-scale.ts)
// — both the mint's dropped pin and the findspot dots share this one color,
// fully opaque (a dropped pin is always opaque regardless -- see
// dropPinHtml's own doc comment -- and .map-dot-mint-issue-site below is
// deliberately solid, not the translucent 0.6-alpha most map-dot roles use).
const MINT_ISSUE_YELLOW = '#eda100'

// Leaflet's vector layers (the dashed connector line below) can't take a CSS
// class, so the line color still needs a real JS value — reads the same
// --map-dot-special token .map-dot-mint-issue-site's CSS uses, so retinting
// that variable keeps both in sync (mirrors HoardMintOriginsMap's
// MINT_LINE_COLOR, the same connector-line pattern in the other direction).
const MINT_LINE_COLOR = 'var(--map-dot-special)'

export function MintIssueDistributionMapCanvas({ mint, sites }: MintIssueDistributionMapCanvasProps) {
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
      const map = L.map(containerRef.current).setView([mint.lat, mint.lng], 6)
      mapRef.current = map

      // Single-page map: no layer-switcher or river-mode controls (those are
      // reserved for the dedicated Map Visualizations pages) — just the
      // street tiles, bilingual labels, and major rivers as a fixed layer.
      const { cyclosm, labelsEn, labelsZh } = buildBaseLayers(L)
      cyclosm.addTo(map)
      labelLayersRef.current = { labelsEn, labelsZh }
      setLabelLayerForLang(map, labelsEn, labelsZh, lang)
      addStaticMajorRivers(L, map)

      const bounds: [number, number][] = [[mint.lat, mint.lng]]

      // Mint center marker — a dropped pin, since this map only ever shows
      // exactly one mint (see dropPinHtml's own doc comment / SinglePointMap).
      L.marker([mint.lat, mint.lng], {
        icon: L.divIcon({
          className: '',
          html: dropPinHtml(MINT_ISSUE_YELLOW),
          iconSize: [PIN_WIDTH, PIN_HEIGHT],
          iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
          popupAnchor: [0, -PIN_HEIGHT],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:13px">
            <strong>Mint town</strong><br/>
            ${mint.name_zh} ${mint.name_en}
          </div>`
        )

      sites.forEach((site) => {
        if (site.lat == null || site.lng == null) return
        bounds.push([site.lat, site.lng])

        // Dashed line connecting the mint to each findspot of its coins.
        L.polyline(
          [
            [mint.lat, mint.lng],
            [site.lat, site.lng],
          ],
          { color: MINT_LINE_COLOR, weight: 1.5, opacity: 0.55, dashArray: '4 5' }
        ).addTo(map)

        L.marker([site.lat, site.lng], {
          icon: L.divIcon({
            className: '',
            html: makeDot('map-dot-mint-issue-site', 12),
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:13px;min-width:190px">
              <strong>${site.site_name_zh ?? site.site_code}</strong><br/>
              ${[site.province_zh, site.city_zh, site.county_zh].filter(Boolean).join(' ')}<br/>
              数量: ${site.total_quantity_for_map ?? 0}<br/>
              <a href="/sites/${site.site_code}" style="color:#006d71">View record →</a>
            </div>`
          )
      })

      map.fitBounds(bounds, { padding: [30, 30] })
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
  }, [sites, mint.lat, mint.lng, mint.name_en, mint.name_zh])

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

  return <div ref={containerRef} style={{ height: '360px', width: '100%' }} />
}
