import { handleStripeWebhook } from './_lib/billing'

/**
 * POST /api/stripe-webhook — Stripe's notifications about subscriptions.
 * Point a webhook endpoint at https://www.retrncrm.com/api/stripe-webhook in
 * the Stripe dashboard. See `_lib/billing.ts`.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleStripeWebhook(req)
}
