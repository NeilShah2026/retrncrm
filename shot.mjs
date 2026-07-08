import { chromium } from 'playwright'
const OUT = '/private/tmp/claude-501/-Users-neilshah-Desktop-Claude-Code-Shit-networkTracker/548841c0-14f9-49a6-8160-48f59bae21cf/scratchpad'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.evaluate(() => window.scrollTo(0, 3550))
await page.waitForTimeout(1400)
await page.screenshot({ path: `${OUT}/v5-network-map.png` })
await browser.close()
console.log('done')
