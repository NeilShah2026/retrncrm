#!/usr/bin/env node
/**
 * One-time Stripe setup for Retrn's web billing. Safe to re-run: everything is
 * looked up before it's created.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs \
 *     --webhook-url https://www.retrncrm.com/api/stripe-webhook
 *
 * Run it once with a test key (sk_test_…) and once with the live key
 * (sk_live_…) — test and live mode are separate worlds in Stripe, each with
 * its own IDs. It creates:
 *
 *   - Products "Retrn Student" and "Retrn Standard", each with a monthly and a
 *     yearly price matching src/lib/billing/plans.ts
 *   - The intro-offer coupon: Student monthly at $3/month for 6 months
 *   - A customer-portal configuration (update card, switch plan, cancel)
 *   - With --webhook-url: the webhook endpoint, and prints its signing secret
 *
 * …and prints the environment variables to paste into Vercel.
 */
import fs from 'node:fs'

// --- config ---------------------------------------------------------------

const SITE = 'https://www.retrncrm.com'

const PLANS = [
  {
    key: 'student',
    name: 'Retrn Student',
    description: 'For students building a network before graduation.',
    prices: { monthly: 499, yearly: 4999 },
  },
  {
    key: 'standard',
    name: 'Retrn Standard',
    description: 'For professionals running a real network.',
    prices: { monthly: 1499, yearly: 14999 },
  },
]

/** $4.99 → $3.00 for the first six months of Student monthly. */
const OFFER = { id: 'retrn-intro-student-3', amountOff: 199, months: 6 }

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]

// --- plumbing -------------------------------------------------------------

function readKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue
    const line = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('STRIPE_SECRET_KEY='))
    if (line) return line.slice('STRIPE_SECRET_KEY='.length).replace(/^"|"$/g, '').trim()
  }
  return ''
}

const KEY = readKey()
if (!KEY.startsWith('sk_')) {
  console.error('Set STRIPE_SECRET_KEY (sk_test_… or sk_live_…) first.')
  process.exit(1)
}
const LIVE = KEY.startsWith('sk_live_')

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function encode(params, prefix = '') {
  const out = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') out.push(...encode(item, `${name}[${i}]`))
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`)
      })
    } else if (typeof value === 'object') {
      out.push(...encode(value, name))
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    }
  }
  return out
}

async function stripe(method, path, params = {}) {
  const body = encode(params).join('&')
  const res = await fetch(`https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(method === 'POST' && { 'Content-Type': 'application/x-www-form-urlencoded' }),
    },
    body: method === 'POST' ? body : undefined,
  })
  const json = await res.json()
  if (!res.ok) {
    const err = new Error(json.error?.message ?? `${method} ${path} failed`)
    err.status = res.status
    throw err
  }
  return json
}

// --- setup ----------------------------------------------------------------

console.log(`Stripe ${LIVE ? 'LIVE' : 'test'} mode\n`)

const env = {}
const prices = {}

for (const plan of PLANS) {
  prices[plan.key] = {}
  const lookupKeys = ['monthly', 'yearly'].map((p) => `retrn_${plan.key}_${p}`)
  const existing = await stripe('GET', '/prices', { lookup_keys: lookupKeys, active: true, limit: 10 })

  let productId = existing.data[0]?.product
  if (!productId) {
    const product = await stripe('POST', '/products', {
      name: plan.name,
      description: plan.description,
      metadata: { retrn_plan: plan.key },
    })
    productId = product.id
    console.log(`Created product ${plan.name} (${productId})`)
  }

  for (const period of ['monthly', 'yearly']) {
    const lookup = `retrn_${plan.key}_${period}`
    let price = existing.data.find((p) => p.lookup_key === lookup)
    if (!price) {
      price = await stripe('POST', '/prices', {
        product: productId,
        currency: 'usd',
        unit_amount: plan.prices[period],
        recurring: { interval: period === 'monthly' ? 'month' : 'year' },
        lookup_key: lookup,
        nickname: `${plan.name} ${period}`,
      })
      console.log(`Created price ${lookup} (${price.id})`)
    }
    prices[plan.key][period] = { id: price.id, product: productId }
    env[`STRIPE_PRICE_${plan.key.toUpperCase()}_${period.toUpperCase()}`] = price.id
  }
}

// The intro offer, limited to the Student product.
try {
  await stripe('GET', `/coupons/${OFFER.id}`)
} catch (err) {
  if (err.status !== 404) throw err
  await stripe('POST', '/coupons', {
    id: OFFER.id,
    name: '$3/month for your first 6 months',
    amount_off: OFFER.amountOff,
    currency: 'usd',
    duration: 'repeating',
    duration_in_months: OFFER.months,
    applies_to: { products: [prices.student.monthly.product] },
  })
  console.log(`Created coupon ${OFFER.id}`)
}
env.STRIPE_OFFER_COUPON = OFFER.id

// The billing portal people reach from "Manage billing".
const portalParams = {
  metadata: { retrn: 'web' },
  business_profile: {
    headline: 'Manage your Retrn subscription',
    privacy_policy_url: `${SITE}/privacy`,
    terms_of_service_url: `${SITE}/terms`,
  },
  default_return_url: `${SITE}/app/subscription`,
  features: {
    customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: PLANS.map((plan) => ({
        product: prices[plan.key].monthly.product,
        prices: [prices[plan.key].monthly.id, prices[plan.key].yearly.id],
      })),
    },
  },
}
const configs = await stripe('GET', '/billing_portal/configurations', { limit: 100 })
const mine = configs.data.find((c) => c.metadata?.retrn === 'web')
const portal = await stripe(
  'POST',
  mine ? `/billing_portal/configurations/${mine.id}` : '/billing_portal/configurations',
  portalParams,
)
env.STRIPE_PORTAL_CONFIG = portal.id
console.log(`${mine ? 'Updated' : 'Created'} portal configuration ${portal.id}`)

const webhookUrl = arg('--webhook-url')
if (webhookUrl) {
  const list = await stripe('GET', '/webhook_endpoints', { limit: 100 })
  const found = list.data.find((w) => w.url === webhookUrl)
  if (found) {
    console.log(`Webhook ${webhookUrl} already exists (${found.id}) — its secret is only shown`)
    console.log('at creation; copy it from Stripe → Developers → Webhooks if you need it again.')
  } else {
    const hook = await stripe('POST', '/webhook_endpoints', {
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
      description: 'Retrn subscriptions',
    })
    env.STRIPE_WEBHOOK_SECRET = hook.secret
    console.log(`Created webhook ${hook.id}`)
  }
}

console.log(`\n# Paste into Vercel → Settings → Environment Variables (${LIVE ? 'Production' : 'Preview/Development'}):`)
console.log(`STRIPE_SECRET_KEY=${LIVE ? '<your sk_live_ key>' : '<your sk_test_ key>'}`)
for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`)
