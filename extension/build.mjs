import * as esbuild from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'

const watch = process.argv.includes('--watch')

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })

// Static assets: manifest, HTML shells, styles, fonts, icons.
cpSync('public', 'dist', { recursive: true })

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  legalComments: 'none',
}

const entries = [
  ['src/popup.tsx', 'dist/popup.js'],
  ['src/panel.tsx', 'dist/panel.js'],
  ['src/content-mail.ts', 'dist/content-mail.js'],
  ['src/background.ts', 'dist/background.js'],
]

const contexts = await Promise.all(
  entries.map(([entry, outfile]) => esbuild.context({ ...common, entryPoints: [entry], outfile })),
)

if (watch) {
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('watching…')
} else {
  await Promise.all(contexts.map((c) => c.rebuild()))
  await Promise.all(contexts.map((c) => c.dispose()))
  console.log('build complete → dist/')
}
