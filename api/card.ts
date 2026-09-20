import { handleCardRequest } from './_lib/card'

/**
 * POST /api/card — publishes a QR card, resolves a scanned short link, and
 * carries details back from whoever scanned it. See `_lib/card.ts` for the
 * whole flow and why each piece needs a server.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleCardRequest(req)
}
