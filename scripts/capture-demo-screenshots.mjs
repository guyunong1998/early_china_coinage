/**
 * (Re)generates the homepage demo carousel's screenshots (see
 * lib/demo-visualizations.ts) by driving the actual running app: the
 * carousel shows one slide at a time, so this clicks through its dot
 * indicators (each tagged [data-demo-id]) to read every slide's id + href
 * straight off the rendered homepage (so it never falls out of sync with
 * the config file), then for each one navigates to that pre-built URL, lets
 * the map settle, and screenshots the page's <main> (i.e. the map + its
 * floating filter panel, not the site header).
 *
 * Requires a dev server already running on localhost:3000 (`npm run dev`).
 *
 *   node scripts/capture-demo-screenshots.mjs            # all demos
 *   node scripts/capture-demo-screenshots.mjs some-id     # just one
 */
import path from 'path'
import { chromium } from 'playwright'
import { cropTo16by9 } from './crop-demo-images.mjs'

const BASE_URL = process.env.DEMO_SCREENSHOT_BASE_URL || 'http://localhost:3000'
const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'home-demos')
const onlyId = process.argv[2]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } })

await page.goto(BASE_URL, { waitUntil: 'networkidle' })
const dots = page.locator('button[data-demo-id]')
const dotCount = await dots.count()
const demos = []
for (let i = 0; i < dotCount; i++) {
  await dots.nth(i).click()
  await page.waitForTimeout(150)
  const activeSlide = page.locator('a[data-demo-id]')
  demos.push({
    id: await activeSlide.getAttribute('data-demo-id'),
    href: await activeSlide.getAttribute('href'),
  })
}

const targets = onlyId ? demos.filter((d) => d.id === onlyId) : demos
if (targets.length === 0) {
  console.error(onlyId ? `No demo card with id "${onlyId}" found.` : 'No demo cards found on the homepage.')
  process.exit(1)
}

for (const demo of targets) {
  const outPath = path.join(OUT_DIR, `${demo.id}.png`)
  console.log(`${demo.id} -> ${demo.href}`)
  await page.goto(`${BASE_URL}${demo.href}`, { waitUntil: 'networkidle' })
  // Let tiles, marker icons, and the density heat canvas finish rendering —
  // networkidle alone doesn't cover Leaflet's own post-load draw/animation.
  await page.waitForTimeout(1500)
  // The find-site map's default zoom fits all of China at once, which at
  // 1000+ points overlaps into an undifferentiated mass — one zoom-in step
  // tightens that meaningfully. The mint-town map starts more zoomed in
  // already (far fewer points), so the same single step keeps it readable
  // too without panning past its only visible clusters.
  const zoomIn = page.locator('.leaflet-control-zoom-in')
  if (await zoomIn.count()) {
    await zoomIn.click()
    await page.waitForTimeout(600)
  }
  await page.locator('main').screenshot({ path: outPath })
  // The viewport/panel screenshot above isn't 16:9 on its own — crop it to
  // match the carousel's fixed frame (see crop-demo-images.mjs) so this
  // slide's box height is identical to every other slide's.
  await cropTo16by9(outPath)
  console.log(`  saved ${path.relative(process.cwd(), outPath)}`)
}

await browser.close()
