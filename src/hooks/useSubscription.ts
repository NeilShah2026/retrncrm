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

/**
 * The account's App Store subscription, as React sees it.
 *
 * Reads the durable cache on mount, then subscribes to every later change —
 * a purchase, a restore, a sign-out — so a screen that shows the plan and a
 * screen that gates on it can never disagree.
 */
export function useSubscription(): {
  subscription: SubscriptionState
  /** False until the cache has been read; keeps the UI from flashing "Free". */
  loaded: boolean
  /** Whether a purchase can be made here at all. */
  canPurchase: boolean
  refresh: () => Promise<void>
} {
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
    subscription,
    loaded,
    canPurchase: isPurchaseSurface() && isBillingAvailable(),
    refresh,
  }
}
