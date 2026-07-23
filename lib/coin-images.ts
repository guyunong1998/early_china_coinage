import fs from 'node:fs'
import path from 'node:path'

// Specimen photography, keyed by museum accession number (coin_type_hierarchy.
// img_acc_num) rather than coin_type_code — one photographed specimen stands
// in for the whole typology node, not any single coin_issues catalogue entry.
// Filenames are whatever the source export used (mixed extensions, an
// occasional " Background Removed" suffix) so we match by prefix instead of
// requiring an exact name.
const TYPE_IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'type_imgs')

export type CoinTypeImagePaths = {
  obverseSrc: string | null
  reverseSrc: string | null
}

const EMPTY_PATHS: CoinTypeImagePaths = { obverseSrc: null, reverseSrc: null }

let filesCache: string[] | null = null

function listTypeImageFiles(): string[] {
  if (filesCache) return filesCache
  filesCache = fs.existsSync(TYPE_IMAGE_DIR) ? fs.readdirSync(TYPE_IMAGE_DIR) : []
  return filesCache
}

function findSide(accNum: string, side: 'obv' | 'rev'): string | null {
  const prefix = `${accNum}.${side}`.toLowerCase()
  const file = listTypeImageFiles().find((f) => f.toLowerCase().startsWith(prefix))
  return file ? `/images/type_imgs/${encodeURIComponent(file)}` : null
}

/**
 * Hand-picked single-icon (not obverse/reverse — these are stylized line-art
 * shapes, not specimen photos) stand-ins for a handful of broad category
 * nodes, keyed by the node's own slug (`fallbackKey` below). Checked before
 * the generic slug-prefixed obv/rev lookup so these take precedence over
 * whatever a plain `{slug}.obv...` file might otherwise match.
 */
const GENERIC_ICON_BY_SLUG: Record<string, string> = {
  'spade-coin': 'spadecoin.svg',
  'knife-shaped-coin': 'knifecoin.svg',
  'flat-handle-spade': 'flathandlespade.svg',
  'hollow-socket-spade': 'hollowsocketspade.svg',
  'flat-shoulder-hollow-socket-spade': 'flatshoulder-hollowsocketspade.svg',
}

function findGenericIcon(slug: string): string | null {
  const file = GENERIC_ICON_BY_SLUG[slug]
  if (!file || !listTypeImageFiles().includes(file)) return null
  return `/images/type_imgs/${encodeURIComponent(file)}`
}

/**
 * `fallbackKey` covers types with no photographed specimen (no img_acc_num):
 * a synthetic "children silhouette" composite, generated for nodes that
 * still lack their own image, is saved under the node's own slug (see
 * lib/coin-type-silhouette.ts) — pass `node.slug` here to pick it up.
 */
export function getCoinTypeImagePaths(
  accNum: string | null | undefined,
  fallbackKey?: string | null
): CoinTypeImagePaths {
  const primary: CoinTypeImagePaths = accNum
    ? { obverseSrc: findSide(accNum, 'obv'), reverseSrc: findSide(accNum, 'rev') }
    : EMPTY_PATHS
  if (primary.obverseSrc || primary.reverseSrc) return primary
  if (!fallbackKey) return primary

  const generic = findGenericIcon(fallbackKey)
  if (generic) return { obverseSrc: generic, reverseSrc: null }

  return { obverseSrc: findSide(fallbackKey, 'obv'), reverseSrc: findSide(fallbackKey, 'rev') }
}
