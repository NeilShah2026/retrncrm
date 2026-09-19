/**
 * The subscription catalogue: the single source of truth for what Retrn
 * sells, what each tier unlocks, and — crucially — which App Store product
 * each paid tier maps to.
 *
 * Nothing here talks to a store. It is deliberately just data, so the paywall
 * can be built, reviewed and shipped before there is an Apple Developer
 * account behind it: `store.ts` is what turns a `PlanId` into a real purchase
 * once a provider is plugged in.
 *
 * ## Wiring this to App Store Connect later
 *
 * 1. In App Store Connect → your app → Subscriptions, create one
 *    *subscription group* ("Retrn") holding four auto-renewable products.
 * 2. Give each product the **exact** product ID in `appStoreProductId` below.
 *    They are reverse-DNS under the bundle ID (`com.neilshah.retrn`) so they
 *    can never collide with another app's.
 * 3. Set each one's price and duration to match `price` / `period` here.
 *    Apple's localized price is what the paywall actually shows once a
 *    provider is connected — the strings here are the pre-store fallback, so
 *    keep them in step with App Store Connect to avoid a review flag for a
 *    price that disagrees with the store.
 */

export type PlanId = 'free' | 'student' | 'standard'
export type BillingPeriod = 'monthly' | 'yearly'

export interface PlanPrice {
  /** Fallback display price, used until the store returns a localized one. */
  display: string
  /** Price in US cents — for "$X.XX/mo billed yearly" style maths only. */
  cents: number
  period: BillingPeriod
  /**
   * The App Store Connect product ID. `null` for a tier with nothing to buy
   * (Free), or one granted outside the store (the Babson offer).
   */
  appStoreProductId: string | null
}

export interface Plan {
  id: PlanId
  name: string
  /** One line under the name on the paywall. */
  tagline: string
  /** The strongest reason to pick this one, shown as a badge. */
  badge?: string
  prices: Record<BillingPeriod, PlanPrice> | null
  featuresLead?: string
  features: string[]
}

/** The bundle ID every product ID hangs off. Matches capacitor.config.ts. */
export const BUNDLE_ID = 'com.neilshah.retrn'

/**
 * The subscription group all paid products belong to. One group means iOS
 * handles upgrades, downgrades and crossgrades between Student and Standard
 * as a single subscription rather than two competing ones.
 */
export const SUBSCRIPTION_GROUP = 'retrn'

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Start building your network today',
    prices: null,
    features: [
      'Up to 30 contacts',
      'Tags, filters and last-contact tracking',
      'Reconnect suggestions on the dashboard',
      '25 AI requests a day',
      'Private and synced to your account',
    ],
  },
  {
    id: 'student',
    name: 'Student',
    tagline: 'For students, with a verified .edu email',
    badge: 'Best value',
    prices: {
      monthly: {
        display: '$4.99',
        cents: 499,
        period: 'monthly',
        appStoreProductId: `${BUNDLE_ID}.student.monthly`,
      },
      yearly: {
        display: '$49.99',
        cents: 4999,
        period: 'yearly',
        appStoreProductId: `${BUNDLE_ID}.student.yearly`,
      },
    },
    featuresLead: 'Everything in Free, plus',
    features: [
      'Unlimited contacts',
      'Voice, photo and one-line capture',
      'Recruiting pipeline',
      'Follow-ups and key-date reminders',
      'CSV and JSON export',
      '250 AI requests a day',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'For professionals running a real network',
    prices: {
      monthly: {
        display: '$14.99',
        cents: 1499,
        period: 'monthly',
        appStoreProductId: `${BUNDLE_ID}.standard.monthly`,
      },
      yearly: {
        display: '$149.99',
        cents: 14999,
        period: 'yearly',
        appStoreProductId: `${BUNDLE_ID}.standard.yearly`,
      },
    },
    featuresLead: 'Everything in Student, plus',
    features: [
      'Calendar sync and auto-logged meetings',
      '600 AI requests a day',
      'No school email needed',
      'Everything first, as it ships',
    ],
  },
]

/** Every product ID the store needs to be asked about, in catalogue order. */
export const ALL_PRODUCT_IDS: string[] = PLANS.flatMap((plan) =>
  plan.prices
    ? [plan.prices.monthly.appStoreProductId, plan.prices.yearly.appStoreProductId].filter(
        (id): id is string => Boolean(id),
      )
    : [],
)

export function planById(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}

/** Which plan a store product belongs to, for turning a receipt into access. */
export function planForProductId(productId: string): { plan: Plan; period: BillingPeriod } | null {
  for (const plan of PLANS) {
    if (!plan.prices) continue
    for (const period of ['monthly', 'yearly'] as const) {
      if (plan.prices[period].appStoreProductId === productId) return { plan, period }
    }
  }
  return null
}

/** "$4.17/mo, billed yearly" — the comparison a yearly price is really making. */
export function monthlyEquivalent(price: PlanPrice): string | null {
  if (price.period !== 'yearly') return null
  return `$${(price.cents / 12 / 100).toFixed(2)}/mo, billed yearly`
}

/** How much a year of the yearly plan saves against twelve monthly ones. */
export function yearlySavingPercent(plan: Plan): number | null {
  if (!plan.prices) return null
  const yearOfMonthly = plan.prices.monthly.cents * 12
  if (yearOfMonthly <= 0) return null
  return Math.round((1 - plan.prices.yearly.cents / yearOfMonthly) * 100)
}

// ---------------------------------------------------------------------------
// The free tier's limit, and the offer shown when someone reaches it
// ---------------------------------------------------------------------------

/**
 * How many contacts a free account holds. The database enforces the same
 * number (`enforce_free_contact_limit` in 0007_billing.sql) — keep them equal.
 */
export const FREE_CONTACT_LIMIT = 30

/**
 * The upgrade offer: Student at $3/month for the first six months, then the
 * normal monthly price. On the web it is a Stripe coupon (STRIPE_OFFER_COUPON,
 * created by scripts/stripe-setup.mjs) applied at checkout, and only to
 * accounts that have never subscribed before.
 */
export const INTRO_OFFER = {
  plan: 'student' as const,
  period: 'monthly' as const,
  display: '$3',
  cents: 300,
  months: 6,
}
