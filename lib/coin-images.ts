import fs from 'node:fs'
import path from 'node:path'

// Local-file convention for coin photography, mirroring lib/mint-towns.ts's
// `public/images/mints/` pattern. Drop files in here — no code changes needed.
const COIN_IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'coins')

export type CoinTypeImagePaths = {
  obverseSrc: string | null
  reverseSrc: string | null
}

export function getCoinTypeImagePaths(coinTypeCode: string): CoinTypeImagePaths {
  const obverseFile = `${coinTypeCode}-obverse.png`
  const reverseFile = `${coinTypeCode}-reverse.png`

  return {
    obverseSrc: fs.existsSync(path.join(COIN_IMAGE_DIR, obverseFile))
      ? `/images/coins/${obverseFile}`
      : null,
    reverseSrc: fs.existsSync(path.join(COIN_IMAGE_DIR, reverseFile))
      ? `/images/coins/${reverseFile}`
      : null,
  }
}
