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

export function getCoinTypeImagePaths(accNum: string | null | undefined): CoinTypeImagePaths {
  if (!accNum) return EMPTY_PATHS
  return {
    obverseSrc: findSide(accNum, 'obv'),
    reverseSrc: findSide(accNum, 'rev'),
  }
}
