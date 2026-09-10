'use client'

/**
 * Site detail page's "Coin Mint Origins" section: a coin-type filter
 * dropdown, the mint-origins map (OriginDistributionMap, a pure map), and a
 * caption below it — the site-direction sibling of
 * components/mints/MintIssueDistribution.tsx (one mint's find sites vs one
 * site's mints of origin).
 *
 * Used by: app/sites/[site_code]/page.tsx, which builds `mints`/`mintTypeKeys`/
 * `typeOptions` (see buildMintOrigins) and renders its own Panel/heading and
 * "unmapped mints" hint around this.
 */

import { useMemo, useState } from 'react'
import { OriginDistributionMap, type OriginDistributionPoint } from '@/components/map/OriginDistributionMap'
import { T } from '@/components/i18n/T'

export type HoardMintOrigin = {
  mint_code?: string
  mint_zh: string
  mint_en?: string | null
  lat: number
  lng: number
  quantity: number
  findCount: number
  coinTypes: string[]
}

export type MintOriginTypeOption = {
  key: string
  label: string
  mintCount: number
}

type SiteMintOriginsProps = {
  site: {
    site_code: string
    name_zh: string | null
    name_en?: string | null
    lat: number
    lng: number
  }
  mints: HoardMintOrigin[]
  /** Coin-type keys present at this site attributed to each mint, keyed by
   * `mint_zh` (same key buildMintOrigins groups by). */
  mintTypeKeys: Record<string, string[]>
  typeOptions: MintOriginTypeOption[]
}

// Same brand-accent color for the site's own pin, every mint dot, and the
// connector lines between them — fully opaque, since only one hoard's
// markers are ever on screen together (unlike --map-dot-special's
// translucent use elsewhere, which exists to disambiguate overlapping points).
const SITE_ORIGIN_COLOR = 'var(--map-pin-accent)'

export function SiteMintOrigins({ site, mints, mintTypeKeys, typeOptions }: SiteMintOriginsProps) {
  const [selectedType, setSelectedType] = useState('all')

  const filteredMints = useMemo(() => {
    if (selectedType === 'all') return mints
    return mints.filter((mint) => (mintTypeKeys[mint.mint_zh] ?? []).includes(selectedType))
  }, [selectedType, mints, mintTypeKeys])

  const origin: OriginDistributionPoint = {
    key: site.site_code,
    lat: site.lat,
    lng: site.lng,
    openPopup: true,
    popupHtml: `<div class="map-popup" style="min-width:170px">
      <strong>Findspot / 发现地</strong><br/>
      ${site.name_zh ?? site.site_code}
    </div>`,
  }

  const destinations: OriginDistributionPoint[] = filteredMints.map((mint) => {
    const coinTypesList = mint.coinTypes.length > 0 ? mint.coinTypes.join('、') : '—'
    return {
      key: mint.mint_code ?? mint.mint_zh,
      lat: mint.lat,
      lng: mint.lng,
      popupHtml: `<div class="map-popup" style="min-width:200px">
        <strong>Mint town / 铸币地：</strong>${mint.mint_zh}${mint.mint_en ? ` <span class="map-popup-muted-italic">(${mint.mint_en})</span>` : ''}<br/>
        <strong>Coin types / 币类：</strong>${coinTypesList}<br/>
        <strong>Quantity in this hoard / 数量：</strong>${mint.quantity || mint.findCount}<br/>
        ${mint.mint_code ? `<a href="/mints/${mint.mint_code}" class="map-popup-link">View mint town →</a>` : ''}
      </div>`,
    }
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="site-mint-type-filter" className="text-sm font-semibold text-gray-700">
          Coin type filter:
        </label>
        <select
          id="site-mint-type-filter"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded border border-brand/30 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
        >
          <option value="all">All coin types ({mints.length} mints)</option>
          {typeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.mintCount})
            </option>
          ))}
        </select>
      </div>

      <OriginDistributionMap kind="site" color={SITE_ORIGIN_COLOR} origin={origin} destinations={destinations} />

      <p className="text-xs text-gray-500">
        <T k="site.mintOrigins.caption" />
      </p>
    </div>
  )
}
