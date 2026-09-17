import { isNative } from '@/lib/platform'
import {
  ALL_PRODUCT_IDS,
  planForProductId,
  type BillingPeriod,
  type PlanId,
} from './plans'

/**
 * The seam between Retrn and whatever actually takes the money.
 *
 * There is no Apple Developer account yet, so there is no in-app purchase yet
 * — but every screen that *would* sell something is built and shipping. This
 * module is what makes that safe: the paywall asks `billing` for products and
 * calls `purchase()`, and `billing` answers "no store is connected" until a
 * provider is registered. Nothing in the UI has to know which of those two
 * worlds it is in, and nothing has to be rewritten when the second arrives.
 *
 * ## Connecting a real store (one file, one call)
 *
 * When the Apple Developer account is live:
 *
 * 1. Add a StoreKit bridge — either `cordova-plugin-purchase` (works with
 *    Capacitor, no native code to write) or RevenueCat's Capacitor SDK if you
 *    want server-side receipt validation for free.
 * 2. Write `src/lib/billing/providers/<name>.ts` exporting a
 *    `BillingProvider` that adapts that SDK's shapes to the four methods in
 *    the interface below.
 * 3. Call `setBillingProvider(provider)` once, from `bootstrapNative()` in
 *    src/lib/nativeBootstrap.ts, behind `isNative`.
 *
 * Nothing else changes. The paywall, the Settings rows, `useEntitlement` and
 * the restore flow all start working the moment step 3 runs.
 *
 * ## Why the entitlement is cached locally
 *
 * StoreKit is the authority on whether a subscription is live, but it is only
 * reachable on the device, and only while the App Store is up. The last known
 * good answer is written to durable native storage so the app knows what it
 * has been paid for at launch, offline, and in the seconds before the store
 * responds. It is a cache, never proof: anything that must not be spoofed
 * (a server-side feature, a paid API call) has to check a validated receipt
 * on the server, not this.
 */

/** A purchasable product as the store describes it. */
export interface StoreProduct {
  productId: string
  /** The store's own localized price string — "$4.99", "4,99 €". */
  price: string
  title?: string
  description?: string
}

/** What the app remembers about a completed purchase. */
export interface SubscriptionState {
  active: boolean
  plan: PlanId
  period: BillingPeriod | null
  productId: string | null
  /** ISO date the current period ends, when the store tells us. */
  expiresAt: string | null
  /** True while the subscription is in its introductory/free trial period. */
  inTrial: boolean
  /** Where this came from, for support and for the Settings row's subtitle. */
  source: 'app-store' | 'none'
  /** When this cache was last refreshed from the store. */
  checkedAt: string | null
}

export const NO_SUBSCRIPTION: SubscriptionState = {
  active: false,
  plan: 'free',
  period: null,
  productId: null,
  expiresAt: null,
  inTrial: false,
  source: 'none',
  checkedAt: null,
}

/** The four things any store has to be able to do for us. */
export interface BillingProvider {
  /** For logs and the Settings "managed by" line. */
  readonly name: string
  /** Connect to the store and load the catalogue. Called once, lazily. */
  init(): Promise<void>
  /** Prices for these product IDs, localized by the store. */
  getProducts(productIds: string[]): Promise<StoreProduct[]>
  /** Run the purchase sheet. Resolves once the transaction is finished. */
  purchase(productId: string): Promise<SubscriptionState>
  /** Re-read what this Apple ID already owns. Required by App Store review. */
  restore(): Promise<SubscriptionState>
  /**
   * Open the system's own subscription management screen. Optional: without
   * it the app falls back to Apple's `itms-apps://` URL.
   */
  manage?(): Promise<void>
}

export class BillingUnavailableError extends Error {
  constructor(message = 'In-app purchases aren’t available yet.') {
    super(message)
    this.name = 'BillingUnavailableError'
  }
}

const STORAGE_KEY = 'retrn.subscription.v1'

let provider: BillingProvider | null = null
let initialized: Promise<void> | null = null
let cached: SubscriptionState | null = null

const listeners = new Set<(state: SubscriptionState) => void>()

/** Register the live store. Call once at startup; see the header comment. */
export function setBillingProvider(next: BillingProvider): void {
  provider = next
  initialized = null
}

/**
 * Whether anything can actually be bought right now. The paywall stays fully
 * visible either way — it explains the plans and takes an email for launch
 * instead of offering a button that cannot work.
 */
export function isBillingAvailable(): boolean {
  return provider !== null
}

/**
 * True where a store *could* exist. Purchases are an iOS-app-only affordance:
 * on the web the same account is managed from the website, and App Store
 * rules forbid pointing at that from inside the app (Guideline 3.1.1), so the
 * web build simply doesn't show a purchase button at all.
 */
export function isPurchaseSurface(): boolean {
  return isNative
}

async function ensureInit(): Promise<BillingProvider> {
  if (!provider) throw new BillingUnavailableError()
  initialized ??= provider.init()
  await initialized
  return provider
}

// --- The local entitlement cache -------------------------------------------

async function readStored(): Promise<SubscriptionState> {
  try {
    const raw = isNative
      ? (await (await import('@capacitor/preferences')).Preferences.get({ key: STORAGE_KEY })).value
      : window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return NO_SUBSCRIPTION
    const parsed = JSON.parse(raw) as Partial<SubscriptionState>
    return { ...NO_SUBSCRIPTION, ...parsed }
  } catch {
    return NO_SUBSCRIPTION
  }
}

async function writeStored(state: SubscriptionState): Promise<void> {
  try {
    const raw = JSON.stringify(state)
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: STORAGE_KEY, value: raw })
    } else {
      window.localStorage.setItem(STORAGE_KEY, raw)
    }
  } catch {
    // A cache that can't be written is still a working app — the store is
    // asked again next launch.
  }
}

/** An expired period means expired access, whatever the cache last said. */
function withExpiry(state: SubscriptionState): SubscriptionState {
  if (!state.active || !state.expiresAt) return state
  if (Date.parse(state.expiresAt) > Date.now()) return state
  return { ...NO_SUBSCRIPTION, checkedAt: state.checkedAt }
}

function publish(state: SubscriptionState): SubscriptionState {
  cached = state
  void writeStored(state)
  for (const listener of listeners) listener(state)
  return state
}

/** Watch the entitlement. Returns an unsubscribe. */
export function onSubscriptionChange(listener: (state: SubscriptionState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The last known entitlement, synchronously. `null` until first loaded. */
export function peekSubscription(): SubscriptionState | null {
  return cached
}

/** Load the cached entitlement from durable storage. Safe to call repeatedly. */
export async function loadSubscription(): Promise<SubscriptionState> {
  if (cached) return cached
  const state = withExpiry(await readStored())
  cached = state
  for (const listener of listeners) listener(state)
  return state
}

// --- What the UI calls ------------------------------------------------------

/**
 * Prices for the catalogue, localized by the store where one is connected.
 * Returns an empty list — never throws — when there is no store, so a paywall
 * can fall back to the catalogue's own strings without a try/catch.
 */
export async function getProducts(
  productIds: string[] = ALL_PRODUCT_IDS,
): Promise<StoreProduct[]> {
  if (!provider) return []
  try {
    const store = await ensureInit()
    return await store.getProducts(productIds)
  } catch (err) {
    console.warn('[billing] could not load products', err)
    return []
  }
}

/** Buy one product. Throws `BillingUnavailableError` when no store is wired. */
export async function purchase(productId: string): Promise<SubscriptionState> {
  const store = await ensureInit()
  const state = await store.purchase(productId)
  return publish(withExpiry(state))
}

/**
 * "Restore Purchases". App Store review requires this to exist and to work on
 * a fresh install — an Apple ID that already pays must not be asked twice.
 */
export async function restorePurchases(): Promise<SubscriptionState> {
  const store = await ensureInit()
  const state = await store.restore()
  return publish(withExpiry(state))
}

/**
 * Ask the store what this account owns and refresh the cache. Quietly does
 * nothing without a provider, so it is safe to call on every app launch.
 */
export async function refreshSubscription(): Promise<SubscriptionState> {
  if (!provider) return loadSubscription()
  try {
    const store = await ensureInit()
    return publish(withExpiry(await store.restore()))
  } catch (err) {
    console.warn('[billing] could not refresh subscription', err)
    return loadSubscription()
  }
}

/**
 * Apple's own "Manage Subscriptions" screen — where a subscription is
 * cancelled. App Store review expects an app that sells a subscription to
 * point at this rather than to handle cancellation itself.
 */
export async function openManageSubscriptions(): Promise<void> {
  if (provider?.manage) {
    await provider.manage()
    return
  }
  const url = 'https://apps.apple.com/account/subscriptions'
  if (isNative) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

/** Turn a store product ID into the entitlement it grants. For providers. */
export function stateForProduct(
  productId: string,
  extras: { expiresAt?: string | null; inTrial?: boolean } = {},
): SubscriptionState {
  const match = planForProductId(productId)
  if (!match) return NO_SUBSCRIPTION
  return {
    active: true,
    plan: match.plan.id,
    period: match.period,
    productId,
    expiresAt: extras.expiresAt ?? null,
    inTrial: extras.inTrial ?? false,
    source: 'app-store',
    checkedAt: new Date().toISOString(),
  }
}

/** Forget the cached entitlement — on sign-out, so it can't leak across accounts. */
export async function clearSubscriptionCache(): Promise<void> {
  publish(NO_SUBSCRIPTION)
}
