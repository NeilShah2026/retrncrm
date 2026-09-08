import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAiRequest } from './api/_lib/ai.ts'
import { handleVerifyEduRequest } from './api/_lib/eduVerify.ts'

type EdgeHandler = (req: Request) => Promise<Response>

/**
 * `vite dev` doesn't serve `/api` — that's Vercel's job in production. Rather
 * than make everyone run `vercel dev` to try an AI feature or verify a school
 * email, this serves those endpoints locally by calling the *same* handlers
 * the edge functions do, so the two can't drift.
 */
const DEV_ROUTES: Record<string, EdgeHandler> = {
  '/api/ai': handleAiRequest,
  '/api/verify-edu': handleVerifyEduRequest,
}

function devApi(): Plugin {
  return {
    name: 'retrn-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      for (const [route, handler] of Object.entries(DEV_ROUTES)) {
        server.middlewares.use(
          route,
          (req: IncomingMessage, res: ServerResponse) => {
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              const body = Buffer.concat(chunks)
              const request = new Request(`http://localhost${route}`, {
                method: req.method ?? 'POST',
                headers: new Headers(
                  Object.entries(req.headers)
                    .filter((entry): entry is [string, string] =>
                      typeof entry[1] === 'string',
                    ),
                ),
                body: body.length ? body : undefined,
              })
              handler(request)
                .then(async (response) => {
                  res.statusCode = response.status
                  response.headers.forEach((value, key) => res.setHeader(key, value))
                  res.end(await response.text())
                })
                .catch((err: unknown) => {
                  console.error(`[dev ${route}]`, err)
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Dev handler crashed.' }))
                })
            })
          },
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The handlers read server-only secrets from process.env; Vite otherwise
  // only exposes VITE_-prefixed vars, and deliberately so.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value
  }

  return {
    plugins: [react(), devApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
