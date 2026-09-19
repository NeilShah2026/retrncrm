import { handleBillingRequest } from './_lib/billing'

/**
 * POST /api/billing — starts a Stripe Checkout, or opens the Stripe billing
 * portal, for the signed-in account. Website only. See `_lib/billing.ts`.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleBillingRequest(req)
}
