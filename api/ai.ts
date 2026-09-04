import { handleAiRequest } from './_lib/ai'

/**
 * POST /api/ai — the browser's only route to the model.
 *
 * The gateway key lives here (server-only env) rather than in the bundle, so
 * this endpoint has to prove the caller is a signed-in Retrn user before it
 * spends anything. All of that is in `_lib/ai.ts`, which the Vite dev
 * middleware also calls — one implementation, no dev/prod drift.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleAiRequest(req)
}
