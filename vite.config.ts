import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAiRequest } from './api/_lib/ai.ts'

/**
 * `vite dev` doesn't serve `/api` — that's Vercel's job in production. Rather
 * than make everyone run `vercel dev` to try an AI feature, this serves the
 * one endpoint locally by calling the *same* handler the edge function does,
 * so the two can't drift.
 */
function devAiApi(): Plugin {
  return {
    name: 'retrn-dev-ai-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        '/api/ai',
        (req: IncomingMessage, res: ServerResponse) => {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            const body = Buffer.concat(chunks)
            const request = new Request('http://localhost/api/ai', {
              method: req.method ?? 'POST',
              headers: new Headers(
                Object.entries(req.headers)
                  .filter((entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
                  ),
              ),
              body: body.length ? body : undefined,
            })
            handleAiRequest(request)
              .then(async (response) => {
                res.statusCode = response.status
                response.headers.forEach((value, key) => res.setHeader(key, value))
                res.end(await response.text())
              })
              .catch((err: unknown) => {
                console.error('[dev /api/ai]', err)
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Dev AI handler crashed.' }))
              })
          })
        },
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The handler reads server-only secrets from process.env; Vite otherwise
  // only exposes VITE_-prefixed vars, and deliberately so.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value
  }

  return {
    plugins: [react(), devAiApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
