import { chromium } from 'playwright'
import path from 'node:path'

const BASE = 'http://localhost:5173'
const DATA_FILE =
  '/private/tmp/claude-501/-Users-neilshah-Desktop-Claude-Code-Shit-networkTracker/548841c0-14f9-49a6-8160-48f59bae21cf/scratchpad/screenshot-data.json'
const OUT_DIR = path.resolve('public/marketing')

const browser = await chromium.launch()

// ---- Desktop context: boot app, import sample data, capture dialogs ----
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
await ctx.addInitScript(() => localStorage.setItem('rolo-theme', 'dark'))
// Skip the onboarding tour so it doesn't block screenshots.
await ctx.addInitScript(() => localStorage.setItem('rolo-onboarded', '1'))

await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.locator('input[type="file"]').setInputFiles(DATA_FILE)
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Merge' }).click()
await page.waitForTimeout(800)

// Pipeline: open the edit dialog on a card to show real interactivity.
await page.goto(`${BASE}/app/pipeline`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByText('Stripe', { exact: true }).first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(OUT_DIR, 'feature-pipeline-2.png') })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// Templates: compose dialog with a merged preview.
await page.goto(`${BASE}/app/templates`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const card = page.locator('.group', { hasText: 'Coffee chat request' }).first()
await card.getByRole('button', { name: 'Use template' }).click()
await page.waitForTimeout(300)
await page.getByText('Someone else…').click()
await page.getByRole('option').nth(1).click()
await page.getByLabel('Your name').fill('Jamie Rivera')
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(OUT_DIR, 'feature-templates-2.png') })
await page.keyboard.press('Escape')

// New contact dialog for the pipeline/contacts second frame if needed later.
await page.goto(`${BASE}/app/contacts`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

// ---- Mobile context: Contacts grid at phone viewport ----
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mobile = await mobileCtx.newPage()
await mobileCtx.addInitScript(() => localStorage.setItem('rolo-theme', 'dark'))
await mobileCtx.addInitScript(() => localStorage.setItem('rolo-onboarded', '1'))
await mobile.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(700)
await mobile.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(400)
await mobile.locator('input[type="file"]').setInputFiles(DATA_FILE)
await mobile.waitForTimeout(500)
await mobile.getByRole('button', { name: 'Merge' }).click()
await mobile.waitForTimeout(800)
await mobile.goto(`${BASE}/app/contacts`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(500)
const gridBtn = mobile.getByLabel('Grid view')
if (await gridBtn.isVisible()) await gridBtn.click()
await mobile.waitForTimeout(400)
await mobile.screenshot({ path: path.join(OUT_DIR, 'feature-contacts-phone.png') })

await browser.close()
console.log('Screenshots written to', OUT_DIR)
