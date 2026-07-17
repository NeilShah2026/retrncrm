import * as esbuild from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'

const watch = process.argv.includes('--watch')

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })

// Copy static assets (manifest, popup html/css, icons) into dist.
cpSync('public', 'dist', { recursive: true })

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
}

const contexts = await Promise.all([
  esbuild.context({ ...common, entryPoints: ['src/popup.ts'], outfile: 'dist/popup.js' }),
])

if (watch) {
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('watching…')
} else {
  await Promise.all(contexts.map((c) => c.rebuild()))
  await Promise.all(contexts.map((c) => c.dispose()))
  console.log('build complete → dist/')
}
