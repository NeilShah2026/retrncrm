// One-off generator for the iOS app icon + splash screen source images.
// Renders the existing brand mark (public/favicon.svg — the same glyph
// already used for the PWA icons and apple-touch-icon) at native resolution
// via a headless browser, since no SVG rasterizer (rsvg-convert/ImageMagick)
// is available in this environment. Run with: node scripts/generate-ios-assets.mjs
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8')
const outDir = join(root, 'resources')
mkdirSync(outDir, { recursive: true })

const MARK_BG = '#6366f1'
const LIGHT_BG = '#ffffff'
const DARK_BG = '#111113'

function page({ size, bg, markSize, transparent }) {
  return `<!doctype html><html><head><style>
    * { margin: 0; padding: 0; }
    html, body { width: ${size}px; height: ${size}px; background: ${transparent ? 'transparent' : bg}; }
    .wrap { width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; }
    svg { width: ${markSize}px; height: ${markSize}px; display: block; }
  </style></head><body><div class="wrap">${svg}</div></body></html>`
}

const browser = await chromium.launch()
const pg = await browser.newPage()

async function shoot(name, opts) {
  await pg.setViewportSize({ width: opts.size, height: opts.size })
  await pg.setContent(page(opts))
  await pg.screenshot({ path: join(outDir, name), omitBackground: Boolean(opts.transparent) })
  console.log('wrote', name)
}

// App icon: full-bleed 1024x1024 mark (the SVG's own rx=8 rounding is
// harmless — iOS re-masks with its own superellipse regardless, same as it
// already does for the PWA's apple-touch-icon today).
await shoot('icon.png', { size: 1024, markSize: 1024, bg: MARK_BG })

// Splash screens: brand-colored mark centered on the app's actual light/dark
// background token (see src/index.css --bg), so the native launch screen
// reads as a continuation of the app rather than a generic white flash.
await shoot('splash.png', { size: 2732, markSize: 440, bg: LIGHT_BG })
await shoot('splash-dark.png', { size: 2732, markSize: 440, bg: DARK_BG })

await browser.close()
console.log('Done. Run: npx @capacitor/assets generate --ios')
