import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  planForPrice,
  stripe,
  StripeError,
  stripeEnv,
  verifyStripeSignature,
  type PaidPlan,
  type Period,
} from './stripe.js'

/**
 * Web billing through Stripe. `api/billing.ts` (checkout and the billing
 * portal) and `api/stripe-webhook.ts` are the edge entry points; the dev
 * middleware in `vite.config.ts` calls these same functions.
 *
 * The flow:
 *  1. The paywall POSTs { action: 'checkout', plan, period, offer } and gets a
 *     Stripe Checkout URL back. The account's Stripe customer is created on
 *     first use and remembered in `subscriptions`.
 *  2. Stripe takes the payment on its own page and sends the person back.
 *  3. Stripe calls the webhook; the webhook writes the subscription's status
 *     into `subscriptions`, which is what the app (and the database's
 *     contact-limit trigger) reads. The browser never writes it.
 *
 * Only ever reached from the website. The iPhone app buys through the App
 * Store and must not link here (App Store Review Guideline 3.1.1).
 */

/** Hosts Stripe may send people back to. Anything else gets the production URL. */
const RETURN_HOSTS = [
  'retrncrm.com',
  'www.retrncrm.com',
  'retrnapp.com',
  'www.retrnapp.com',
  'localhost',
  '127.0.0.1',
]
const PRODUCTION_ORIGIN = 'https://www.retrncrm.com'

/** Statuses that mean "one is already running" — a second checkout would double-bill. */
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'incomplete']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, 'public', 'public', any, any>

interface SubscriptionRow {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string | null
}

/** Has a school address been proven for this account? */
function isVerifiedStudent(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {}
  return meta.edu_verified === true || meta.babson_verified === true
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function supabaseEnv() {
  return {
    url: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  }
}

function adminClient(): Admin {
  const { url, serviceRoleKey } = supabaseEnv()
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function returnOrigin(req: Request): string {
  const origin = req.headers.get('origin')
  if (!origin) return PRODUCTION_ORIGIN
  try {
    return RETURN_HOSTS.includes(new URL(origin).hostname) ? origin : PRODUCTION_ORIGIN
  } catch {
    return PRODUCTION_ORIGIN
  }
}

// ---------------------------------------------------------------------------
// Checkout and the billing portal
// ---------------------------------------------------------------------------

async function handleBilling(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { url, anonKey, serviceRoleKey } = supabaseEnv()
  const { secretKey } = stripeEnv()
  if (!url || !anonKey || !serviceRoleKey || !secretKey) {
    return json({ error: 'Payments aren’t set up on this deployment yet.' }, 503)
  }

  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const reader = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: caller } = token ? await reader.auth.getUser(token) : { data: { user: null } }
  const user = caller.user
  if (!user) return json({ error: 'Sign in to manage your subscription.' }, 401)

  let body: { action?: unknown; plan?: unknown; period?: unknown; offer?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Malformed request body.' }, 400)
  }

  const admin = adminClient()
  const { data } = await admin
    .from('subscriptions')
    .select('user_id, stripe_customer_id, stripe_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle()
  const row = data as SubscriptionRow | null
  const origin = returnOrigin(req)

  try {
    if (body.action === 'portal') {
      if (!row?.stripe_customer_id) return json({ error: 'There’s no billing to manage yet.' }, 404)
      return json({ url: await portalUrl(row.stripe_customer_id, origin) }, 200)
    }

    if (body.action !== 'checkout') return json({ error: 'Unknown action.' }, 400)

    const plan = body.plan === 'standard' ? 'standard' : body.plan === 'student' ? 'student' : null
    const period = body.period === 'yearly' ? 'yearly' : body.period === 'monthly' ? 'monthly' : null
    if (!plan || !period) return json({ error: 'Pick a plan and a billing period.' }, 400)

    const price = stripeEnv().prices[plan][period]
    if (!price) return json({ error: 'That plan isn’t on sale yet.' }, 503)

    // Student pricing is for students. The proof is a verified school email
    // (see api/_lib/eduVerify.ts), stamped into app_metadata by the server —
    // so it can't be faked from the browser.
    if (plan === 'student' && !isVerifiedStudent(user)) {
      return json(
        {
          error: 'Verify your school email to subscribe to the Student plan.',
          code: 'EDU_REQUIRED',
        },
        403,
      )
    }

    // Already paying: send them to manage it rather than start a second one.
    if (row?.stripe_customer_id && row.status && LIVE_STATUSES.includes(row.status)) {
      return json({ url: await portalUrl(row.stripe_customer_id, origin), existing: true }, 200)
    }

    const customerId = row?.stripe_customer_id ?? (await createCustomer(admin, user.id, user.email))

    // The intro offer is for first-time subscribers, on the plan it's for.
    const { offerCoupon } = stripeEnv()
    const applyOffer =
      body.offer === true &&
      Boolean(offerCoupon) &&
      plan === 'student' &&
      period === 'monthly' &&
      !row?.stripe_subscription_id

    const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      // A coupon and a promo-code box can't both be offered on one session.
      ...(applyOffer
        ? { discounts: [{ coupon: offerCoupon }] }
        : { allow_promotion_codes: true }),
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      success_url: `${origin}/app/subscription?checkout=success`,
      cancel_url: `${origin}/app/subscription?checkout=cancelled`,
    })

    return json({ url: session.url, offerApplied: applyOffer }, 200)
  } catch (err) {
    console.error('[billing]', err)
    const message = err instanceof StripeError ? err.message : 'Couldn’t reach Stripe. Try again.'
    return json({ error: message }, 502)
  }
}

async function createCustomer(admin: Admin, userId: string, email: string | undefined): Promise<string> {
  const customer = await stripe<{ id: string }>('POST', '/customers', {
    email,
    metadata: { user_id: userId },
  })
  const { error } = await admin
    .from('subscriptions')
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error(`Could not save the Stripe customer: ${error.message}`)
  return customer.id
}

async function portalUrl(customerId: string, origin: string): Promise<string> {
  const { portalConfig } = stripeEnv()
  const session = await stripe<{ url: string }>('POST', '/billing_portal/sessions', {
    customer: customerId,
    return_url: `${origin}/app/subscription`,
    // The configuration scripts/stripe-setup.mjs made (plan switching, etc.);
    // without it Stripe uses the dashboard's default portal settings.
    ...(portalConfig && { configuration: portalConfig }),
  })
  return session.url
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

interface StripeSubscription {
  id: string
  customer: string
  status: string
  cancel_at_period_end?: boolean
  current_period_end?: number
  metadata?: Record<string, string>
  discount?: { end?: number | null } | null
  items?: { data?: { price?: { id?: string }; current_period_end?: number }[] }
}

interface StripeEvent {
  type: string
  data: { object: Record<string, unknown> }
}

const iso = (seconds?: number | null) =>
  typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null

/** Write a Stripe subscription's current state into `subscriptions`. */
async function syncSubscription(admin: Admin, sub: StripeSubscription): Promise<void> {
  let userId = sub.metadata?.user_id
  if (!userId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', sub.customer)
      .maybeSingle()
    userId = (data as { user_id: string } | null)?.user_id
  }
  if (!userId) {
    console.warn('[stripe-webhook] no account for subscription', sub.id)
    return
  }

  const item = sub.items?.data?.[0]
  const match = planForPrice(item?.price?.id ?? '')
  // Newer API versions moved the period end onto the subscription item.
  const periodEnd = sub.current_period_end ?? item?.current_period_end

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'stripe',
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      plan: match?.plan ?? null,
      period: match?.period ?? null,
      status: sub.status,
      current_period_end: iso(periodEnd),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      discount_ends_at: iso(sub.discount?.end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`Could not save subscription ${sub.id}: ${error.message}`)
}

async function handleWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const { webhookSecret, secretKey } = stripeEnv()
  if (!webhookSecret || !secretKey) return json({ error: 'Not configured.' }, 503)

  const raw = await req.text()
  if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), webhookSecret))) {
    return json({ error: 'Bad signature.' }, 400)
  }

  const event = JSON.parse(raw) as StripeEvent
  const admin = adminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { subscription?: string | null }
        if (session.subscription) {
          const sub = await stripe<StripeSubscription>('GET', `/subscriptions/${session.subscription}`)
          await syncSubscription(admin, sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription(admin, event.data.object as unknown as StripeSubscription)
        break
      default:
        // Everything else (invoices, payment intents…) shows up as a status
        // change on the subscription, which is handled above.
        break
    }
  } catch (err) {
    console.error('[stripe-webhook]', event.type, err)
    // A 500 makes Stripe retry, which is what we want for a failed write.
    return json({ error: 'Webhook handling failed.' }, 500)
  }

  return json({ received: true }, 200)
}

export const handleBillingRequest = handleBilling
export const handleStripeWebhook = handleWebhook
export type { PaidPlan, Period }
