/**
 * Center-crops image(s) to the homepage demo carousel's fixed 16:9 frame
 * (DemoVisualizationsCarousel.tsx's `aspect-video` image container) — in
 * place, overwriting the source file. `capture-demo-screenshots.mjs` calls
 * `cropTo16by9()` below automatically after every screenshot it takes; run
 * this file directly after manually dropping a replacement image into
 * public/images/home-demos/ (see lib/demo-visualizations.ts) so every slide
 * keeps the same frame regardless of source aspect ratio — without this,
 * the carousel's box height would jump on every arrow click.
 *
 *   node scripts/crop-demo-images.mjs                     # every image in public/images/home-demos/
 *   node scripts/crop-demo-images.mjs some-id.png          # just one file (relative to that folder)
 *   node scripts/crop-demo-images.mjs /abs/path/image.png  # or an absolute path
 */
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const TARGET_ASPECT_RATIO = 16 / 9
export const DEMO_IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'home-demos')

/** Center-crops one image file to TARGET_ASPECT_RATIO, overwriting it. A
 * no-op (fast, no re-encode) if it already matches. */
export async function cropTo16by9(filePath) {
  const { width, height } = await sharp(filePath).metadata()
  if (!width || !height) throw new Error(`Could not read image dimensions: ${filePath}`)

  const ratio = width / height
  const region =
    ratio > TARGET_ASPECT_RATIO
      ? { left: Math.floor((width - Math.round(height * TARGET_ASPECT_RATIO)) / 2), top: 0, width: Math.round(height * TARGET_ASPECT_RATIO), height }
      : { left: 0, top: Math.floor((height - Math.round(width / TARGET_ASPECT_RATIO)) / 2), width, height: Math.round(width / TARGET_ASPECT_RATIO) }

  if (region.width === width && region.height === height) return { width, height, cropped: false }

  // Fully buffer the cropped result before overwriting the source file —
  // reading and writing the same path in one sharp pipeline can corrupt it.
  const buffer = await sharp(filePath).extract(region).toBuffer()
  await sharp(buffer).toFile(filePath)
  return { width: region.width, height: region.height, cropped: true }
}

// CLI entry point — only runs when this file is executed directly, not when
// capture-demo-screenshots.mjs imports cropTo16by9 from it.
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  const files = arg
    ? [path.isAbsolute(arg) ? arg : path.join(DEMO_IMAGES_DIR, arg)]
    : fs
        .readdirSync(DEMO_IMAGES_DIR)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .map((f) => path.join(DEMO_IMAGES_DIR, f))

  for (const file of files) {
    const result = await cropTo16by9(file)
    const label = path.relative(process.cwd(), file)
    console.log(result.cropped ? `${label}: cropped to ${result.width}x${result.height}` : `${label}: already 16:9, left as-is`)
  }
}
