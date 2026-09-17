import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '@/auth/AuthProvider'
import { readEduStatus, type EduStatus } from '@/lib/eduVerification'
import { useSubscription } from '@/hooks/useSubscription'
import { NO_SUBSCRIPTION, type SubscriptionState } from '@/lib/billing/store'

/**
 * What the signed-in account is entitled to.
 *
 * One place to ask "can they use this?", so paid features gate on
 * `useEntitlement().isPro` rather than each re-deriving the rules. There are
 * two routes to it and they are equal: a verified Babson email, or a live
 * App Store subscription. Anything that gates on `isPro` picks up a new route
 * the day it is added, without being touched.
 */
export type Plan = 'free' | 'babson' | 'student' | 'standard'

export interface Entitlement {
  plan: Plan
  /** True when every paid feature is unlocked. */
  isPro: boolean
  /** How the Babson offer applies to this account, if at all. */
  edu: EduStatus
  /** The App Store subscription behind it, if that's what pays for it. */
  subscription: SubscriptionState
  /** What to call the current plan in the interface. */
  label: string
}

/**
 * The rules, with no React attached — so the same answer can be computed from
 * a user object anywhere (a loader, a test) as from the hook.
 */
export function entitlementFor(
  user: User | null | undefined,
  subscription: SubscriptionState = NO_SUBSCRIPTION,
): Entitlement {
  const edu = readEduStatus(user)
  // The school offer wins when both apply: it costs the student nothing, so
  // showing "Student · $4.99/mo" over a free entitlement would be a lie.
  const plan: Plan = edu.verified ? 'babson' : subscription.active ? subscription.plan : 'free'
  return {
    plan,
    isPro: edu.verified || subscription.active,
    edu,
    subscription,
    label: PLAN_LABELS[plan],
  }
}

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  babson: 'Babson — free',
  student: 'Student',
  standard: 'Standard',
}

export function useEntitlement(): Entitlement {
  const { user } = useAuth()
  const { subscription } = useSubscription()
  return React.useMemo(() => entitlementFor(user, subscription), [user, subscription])
}
