import { supabase } from '@/lib/supabase'
import { postApi } from '@/lib/apiFetch'
import { isNative } from '@/lib/platform'
import { NO_SUBSCRIPTION, type SubscriptionState } from './store'
import type { BillingPeriod, PlanId } from './plans'

/**
 * Web billing (Stripe), from the browser's side.
 *
 * Buying and managing both happen on Stripe's own pages — this only asks
 * /api/billing for the URL and goes there. What the account is paid up for
 * is read from the `subscriptions` row the Stripe webhook keeps current, so
 * a subscription bought on the website also unlocks the iPhone app (which
 * reads the same row, and is allowed to honour it — it just can't link here).
 */

/** Payments on the website. Never in the iPhone app (Guideline 3.1.1). */
export const isWebBilling = !isNative

async function callBilling(body: Record<string, unknown>): Promise<{ url: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in first.')
  const res = await postApi('/api/billing', body, { token })
  let payload: { url?: string; error?: string } = {}
  try {
    payload = (await res.json()) as typeof payload
  } catch {
    // Fall through to the generic message.
  }
  if (!res.ok || !payload.url) {
    throw new Error(payload.error ?? 'Couldn’t reach billing. Try again in a moment.')
  }
  return { url: payload.url }
}

/**
 * Go to Stripe Checkout for a plan. `offer` asks for the first-six-months
 * discount; the server decides whether this account qualifies.
 */
export async function startCheckout(
  plan: Exclude<PlanId, 'free'>,
  period: BillingPeriod,
  { offer = false }: { offer?: boolean } = {},
): Promise<void> {
  const { url } = await callBilling({ action: 'checkout', plan, period, offer })
  window.location.assign(url)
}

/** Stripe's billing portal: change plan, update the card, cancel, invoices. */
export async function openBillingPortal(): Promise<void> {
  const { url } = await callBilling({ action: 'portal' })
  window.location.assign(url)
}

// --- What the account is paid up for -------------------------------------------

interface SubscriptionRow {
  plan: string | null
  period: string | null
  status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  discount_ends_at: string | null
  stripe_subscription_id: string | null
}

export interface WebSubscription extends SubscriptionState {
  /** Stripe's own status: active, trialing, past_due, canceled, incomplete… */
  status: string | null
  cancelAtPeriodEnd: boolean
  discountEndsAt: string | null
  /** Has ever subscribed on the web — the intro offer is for first-timers. */
  hasSubscribedBefore: boolean
  /** A Stripe customer exists, so the billing portal has something to show. */
  hasBillingAccount: boolean
}

export const NO_WEB_SUBSCRIPTION: WebSubscription = {
  ...NO_SUBSCRIPTION,
  status: null,
  cancelAtPeriodEnd: false,
  discountEndsAt: null,
  hasSubscribedBefore: false,
  hasBillingAccount: false,
}

/** Statuses that keep paid features on. past_due is Stripe retrying the card. */
const ACTIVE = ['active', 'trialing', 'past_due']

function fromRow(row: SubscriptionRow | null): WebSubscription {
  if (!row) return NO_WEB_SUBSCRIPTION
  const active = Boolean(row.status && ACTIVE.includes(row.status))
  const plan = row.plan === 'student' || row.plan === 'standard' ? row.plan : 'free'
  return {
    active: active && plan !== 'free',
    plan: active ? plan : 'free',
    period: row.period === 'monthly' || row.period === 'yearly' ? row.period : null,
    productId: null,
    expiresAt: row.current_period_end,
    inTrial: row.status === 'trialing',
    source: 'stripe',
    checkedAt: new Date().toISOString(),
    status: row.status,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    discountEndsAt: row.discount_ends_at,
    hasSubscribedBefore: Boolean(row.stripe_subscription_id),
    hasBillingAccount: true,
  }
}

/** Read this account's web subscription. Empty (not an error) before 0007 runs. */
export async function fetchWebSubscription(): Promise<WebSubscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'plan, period, status, current_period_end, cancel_at_period_end, discount_ends_at, stripe_subscription_id',
    )
    .maybeSingle()
  if (error) return NO_WEB_SUBSCRIPTION
  return fromRow(data as SubscriptionRow | null)
}

// One live watcher per account, shared by every component that asks — the
// entitlement hook runs in dozens of places, and each opening its own
// realtime channel would be dozens of sockets saying the same thing.
let shared: {
  userId: string
  state: WebSubscription | null
  listeners: Set<(state: WebSubscription) => void>
  stop: () => void
} | null = null

let lastKnown: { userId: string; state: WebSubscription } | null = null

function startWatching(userId: string) {
  let alive = true
  const load = () =>
    void fetchWebSubscription().then((state) => {
      if (!alive || !shared || shared.userId !== userId) return
      shared.state = state
      lastKnown = { userId, state }
      shared.listeners.forEach((fn) => fn(state))
    })

  const channel = supabase
    .channel(`subscription-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
      load,
    )
    .subscribe()
  // Back from Stripe's tab, or from the billing portal.
  window.addEventListener('focus', load)
  load()

  return () => {
    alive = false
    window.removeEventListener('focus', load)
    void supabase.removeChannel(channel)
  }
}

/**
 * Keep `onChange` told about the account's web subscription: now, whenever
 * the webhook updates the row, and whenever the window regains focus.
 * Returns an unsubscribe.
 */
export function watchWebSubscription(
  userId: string,
  onChange: (state: WebSubscription) => void,
): () => void {
  if (shared && shared.userId !== userId) {
    shared.stop()
    shared = null
  }
  if (!shared) {
    // Keep the last answer across a restart (every watcher unmounting for a
    // moment on navigation), so the plan doesn't flash back to Free.
    const previous = lastKnown?.userId === userId ? lastKnown.state : null
    shared = { userId, state: previous, listeners: new Set(), stop: () => {} }
    shared.stop = startWatching(userId)
  }
  const current = shared
  current.listeners.add(onChange)
  if (current.state) onChange(current.state)

  return () => {
    current.listeners.delete(onChange)
    if (current.listeners.size === 0 && shared === current) {
      current.stop()
      shared = null
    }
  }
}

/** Ask again now — after returning from checkout, say. */
export function refreshWebSubscription(): void {
  if (!shared) return
  const current = shared
  void fetchWebSubscription().then((state) => {
    if (shared !== current) return
    current.state = state
    lastKnown = { userId: current.userId, state }
    current.listeners.forEach((fn) => fn(state))
  })
}
