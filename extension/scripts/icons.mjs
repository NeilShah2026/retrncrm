// Renders the toolbar and store icons from the web app's brand mark
// (../public/favicon.svg — the same mark as the iOS app icon and the PWA).
// Run with: node scripts/icons.mjs   (needs Playwright's Chromium installed)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8')

// Chrome's store guidance: the 128px icon's artwork is 96px, centred.
const SIZES = [
  { size: 16, art: 16 },
  { size: 32, art: 32 },
  { size: 48, art: 44 },
  { size: 128, art: 96 },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const { size, art } of SIZES) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center">
      <div style="width:${art}px;height:${art}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`)
  await page.screenshot({ path: `public/icons/icon${size}.png`, omitBackground: true })
  console.log(`icons/icon${size}.png`)
}
await browser.close()
