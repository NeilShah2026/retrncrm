# Connecting Retrn to the App Store

The subscription UI ships complete. What it does *not* have is a store behind
it — there is no Apple Developer account yet. This is the checklist for the day
there is. Nothing in `src/pages/SubscriptionPage.tsx`, `useEntitlement` or the
Settings rows needs to change: they already call `src/lib/billing/store.ts`,
which answers "no store connected" until step 4 below runs.

## 1. App Store Connect

Create one **subscription group** (`retrn`) with four auto-renewable products.
The product IDs must match `src/lib/billing/plans.ts` exactly:

| Plan     | Period  | Product ID                              | Price   |
| -------- | ------- | --------------------------------------- | ------- |
| Student  | Monthly | `com.neilshah.retrn.student.monthly`    | $4.99   |
| Student  | Yearly  | `com.neilshah.retrn.student.yearly`     | $49.99  |
| Standard | Monthly | `com.neilshah.retrn.standard.monthly`   | $14.99  |
| Standard | Yearly  | `com.neilshah.retrn.standard.yearly`    | $149.99 |

One group, not two, so iOS treats Student → Standard as an upgrade of a single
subscription rather than two competing ones.

Each product also needs a localized display name, a description, and a review
screenshot, or the submission is rejected before a human sees it.

If the prices change here, change them in `plans.ts` too — the app shows the
store's localized price once connected, but the catalogue strings are what a
reviewer sees if the store call is slow, and a mismatch is a review flag.

## 2. Xcode

Add the **In-App Purchase** capability to the `App` target, and sign in with a
team that has a paid membership. Create a StoreKit configuration file to test
purchases in the simulator without a sandbox Apple ID.

## 3. A bridge, then an adapter

Pick one:

- **`cordova-plugin-purchase`** (v13+) — works under Capacitor with no native
  code to write. Good if you want to stay entirely in JS.
- **RevenueCat** (`@revenuecat/purchases-capacitor`) — adds server-side receipt
  validation, cross-platform entitlements and subscription analytics for free
  at this volume. Worth it if you ever want the *server* to trust the
  entitlement (see the caveat in `store.ts`).

Then write `src/lib/billing/providers/<name>.ts` exporting an object that
satisfies `BillingProvider` from `../store`:

```ts
import { stateForProduct, type BillingProvider } from '../store'

export const appStore: BillingProvider = {
  name: 'app-store',
  async init() { /* connect, load the catalogue */ },
  async getProducts(ids) { /* → [{ productId, price }] with the store's own price strings */ },
  async purchase(productId) {
    // run the purchase sheet, then:
    return stateForProduct(productId, { expiresAt, inTrial })
  },
  async restore() { /* → the state of whatever this Apple ID already owns */ },
}
```

`stateForProduct()` does the product-ID → plan mapping for you, so an adapter
never has to know what "Student" means.

## 4. One call

In `bootstrapNative()` (`src/lib/nativeBootstrap.ts`), before the existing
`refreshSubscription()`:

```ts
setBillingProvider(appStore)
```

That is the whole integration. From that line on, `isBillingAvailable()` is
true, the paywall's buttons say "Subscribe · $4.99" instead of "Available at
launch", Restore Purchases works, and `useEntitlement().isPro` starts counting
a paid subscription alongside the Babson offer.

## 5. What review will look for

All of this is already in the app — it is listed here so it does not get
removed by accident:

- Subscription title, length and price per period on the paywall.
- A **Restore Purchases** control that works on a fresh install.
- Links to the Terms of Use (EULA) and Privacy Policy from the paywall.
- The auto-renewal disclosure text.
- **No** link out to a website to pay (Guideline 3.1.1). The web paywall
  deliberately says "purchased in the iPhone app" rather than linking anywhere.

Also fill in, in App Store Connect: the **Privacy Policy URL**
(`https://retrncrm.com/privacy`), the **EULA / Terms URL**
(`https://retrncrm.com/terms`), and a demo account for the reviewer.
