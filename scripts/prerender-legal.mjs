// Prerenders the Privacy Policy and Terms to static HTML after `vite build`.
//
// The SPA renders every route client-side, so without this the HTML served
// at /privacy and /terms is an empty <div id="root"> — which is exactly what
// App Store review, Google OAuth verification, and the Chrome Web Store see
// when they check those URLs without running JavaScript. vercel.json rewrites
// /privacy and /terms to the files written here.
//
// The output is deliberately script-free: the built stylesheet and the inline
// theme snippet stay, the app bundle does not. Links on the page are plain
// anchors, so navigating away is an ordinary page load into the SPA.
//
// Run with: node scripts/prerender-legal.mjs (part of `npm run build`).
import { readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
// Inside node_modules so the SSR bundle's bare imports (react, react-dom)
// resolve against the project's own dependencies.
const ssrOut = path.join(root, 'node_modules/.cache/retrn-legal-ssr')

await build({
  root,
  logLevel: 'warn',
  build: {
    ssr: 'src/pages/legal/prerender.tsx',
    outDir: ssrOut,
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'prerender.mjs' } },
  },
})

const { LEGAL_PAGES, render } = await import(pathToFileURL(path.join(ssrOut, 'prerender.mjs')).href)
const shell = await readFile(path.join(dist, 'index.html'), 'utf8')

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function fill(html, pattern, replacement, what) {
  if (!pattern.test(html)) throw new Error(`prerender-legal: couldn't find ${what} in dist/index.html`)
  return html.replace(pattern, replacement)
}

for (const page of LEGAL_PAGES) {
  let html = shell
  html = fill(html, /<title>[^<]*<\/title>/, `<title>${page.title}</title>`, '<title>')
  html = fill(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(page.description)}" />\n    <link rel="canonical" href="https://retrncrm.com${page.path}" />`,
    'meta description',
  )
  // Drop the app bundle and its preloads; keep the stylesheet.
  html = html.replace(/\s*<script type="module"[^>]*><\/script>/g, '')
  html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, '')
  html = fill(html, /<div id="root"><\/div>/, () => `<div id="root">${render(page.path)}</div>`, '#root')

  await writeFile(path.join(dist, page.file), html)
  console.log(`prerender-legal: wrote dist/${page.file} (${Math.round(html.length / 1024)} KB)`)
}

await rm(ssrOut, { recursive: true, force: true })
