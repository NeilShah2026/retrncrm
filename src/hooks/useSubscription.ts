import * as React from 'react'
import {
  isBillingAvailable,
  isPurchaseSurface,
  loadSubscription,
  onSubscriptionChange,
  peekSubscription,
  refreshSubscription,
  NO_SUBSCRIPTION,
  type SubscriptionState,
} from '@/lib/billing/store'
import {
  isWebBilling,
  NO_WEB_SUBSCRIPTION,
  watchWebSubscription,
  type WebSubscription,
} from '@/lib/billing/web'
import { useAuth } from '@/auth/AuthProvider'

/**
 * The account's subscription, as React sees it — from whichever store sold
 * it. An App Store purchase lives in a device cache; a website (Stripe)
 * purchase lives in the `subscriptions` row the webhook maintains. Either one
 * unlocks the account everywhere, so this reports whichever is live.
 *
 * Subscribes to every later change — a purchase, a restore, a webhook, a
 * sign-out — so a screen that shows the plan and a screen that gates on it
 * can never disagree.
 */
export function useSubscription(): {
  subscription: SubscriptionState
  /** The Stripe side on its own: billing-portal access, the intro offer. */
  web: WebSubscription
  /** False until the cache has been read; keeps the UI from flashing "Free". */
  loaded: boolean
  /** Whether a purchase can be made here at all. */
  canPurchase: boolean
  refresh: () => Promise<void>
} {
  const { user } = useAuth()
  const userId = user?.id
  const [web, setWeb] = React.useState<WebSubscription>(NO_WEB_SUBSCRIPTION)
  React.useEffect(() => {
    if (!userId) {
      setWeb(NO_WEB_SUBSCRIPTION)
      return
    }
    return watchWebSubscription(userId, setWeb)
  }, [userId])

  const [subscription, setSubscription] = React.useState<SubscriptionState>(
    () => peekSubscription() ?? NO_SUBSCRIPTION,
  )
  const [loaded, setLoaded] = React.useState(() => peekSubscription() !== null)

  React.useEffect(() => {
    let alive = true
    const stop = onSubscriptionChange((next) => {
      if (alive) setSubscription(next)
    })
    void loadSubscription().then((next) => {
      if (!alive) return
      setSubscription(next)
      setLoaded(true)
    })
    return () => {
      alive = false
      stop()
    }
  }, [])

  const refresh = React.useCallback(async () => {
    await refreshSubscription()
  }, [])

  return {
    subscription: subscription.active ? subscription : web.active ? web : subscription,
    web,
    loaded,
    // The website sells through Stripe; the app through the App Store, once
    // a StoreKit provider is connected.
    canPurchase: isWebBilling || (isPurchaseSurface() && isBillingAvailable()),
    refresh,
  }
}
