/**
 * The little of Stripe this app needs, over plain `fetch` — the official SDK
 * leans on Node APIs, and these endpoints run on the edge.
 */

export function stripeEnv() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    offerCoupon: process.env.STRIPE_OFFER_COUPON ?? '',
    portalConfig: process.env.STRIPE_PORTAL_CONFIG ?? '',
    prices: {
      student: {
        monthly: process.env.STRIPE_PRICE_STUDENT_MONTHLY ?? '',
        yearly: process.env.STRIPE_PRICE_STUDENT_YEARLY ?? '',
      },
      standard: {
        monthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY ?? '',
        yearly: process.env.STRIPE_PRICE_STANDARD_YEARLY ?? '',
      },
    },
  }
}

export type PaidPlan = 'student' | 'standard'
export type Period = 'monthly' | 'yearly'

/** Which plan and period a Stripe price ID sells, per the env mapping. */
export function planForPrice(priceId: string): { plan: PaidPlan; period: Period } | null {
  const { prices } = stripeEnv()
  for (const plan of ['student', 'standard'] as const) {
    for (const period of ['monthly', 'yearly'] as const) {
      if (prices[plan][period] && prices[plan][period] === priceId) return { plan, period }
    }
  }
  return null
}

type Params = Record<string, unknown>

/** Stripe's form encoding: nested objects as a[b], arrays as a[0][b]. */
function encode(params: Params, prefix = ''): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          out.push(...encode(item as Params, `${name}[${i}]`))
        } else {
          out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`)
        }
      })
    } else if (typeof value === 'object') {
      out.push(...encode(value as Params, name))
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    }
  }
  return out
}

export class StripeError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'StripeError'
    this.status = status
  }
}

/** Call the Stripe API. GET sends params as a query string, POST as a form. */
export async function stripe<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  params: Params = {},
): Promise<T> {
  const { secretKey } = stripeEnv()
  const body = encode(params).join('&')
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === 'POST' && { 'Content-Type': 'application/x-www-form-urlencoded' }),
    },
    body: method === 'POST' ? body : undefined,
  })
  const json = (await res.json()) as T & { error?: { message?: string } }
  if (!res.ok) {
    throw new StripeError(json.error?.message ?? `Stripe ${path} failed (${res.status})`, res.status)
  }
  return json
}

// --- Webhook signatures -------------------------------------------------------

const TOLERANCE_SECONDS = 300

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Check a `Stripe-Signature` header against the raw request body: an HMAC of
 * `${timestamp}.${body}` with the endpoint's signing secret, within five
 * minutes. Anything that fails this didn't come from Stripe.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false
  const parts = header.split(',').map((p) => p.split('=') as [string, string])
  const timestamp = parts.find(([k]) => k === 't')?.[1]
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = hex(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`)),
  )
  return signatures.some((sig) => timingSafeEqual(sig, expected))
}
