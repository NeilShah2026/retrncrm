import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '@/auth/AuthProvider'
import { readEduStatus, type EduStatus } from '@/lib/eduVerification'

/**
 * What the signed-in account is entitled to.
 *
 * One place to ask "can they use this?", so paid features gate on
 * `useEntitlement().isPro` rather than each re-deriving the rules. Today the
 * only route to `isPro` is a verified Babson email; when billing lands, a paid
 * subscription joins it here and every gate picks it up for free.
 */
export type Plan = 'free' | 'babson'

export interface Entitlement {
  plan: Plan
  /** True when every paid feature is unlocked. */
  isPro: boolean
  /** How the Babson offer applies to this account, if at all. */
  edu: EduStatus
}

export function entitlementFor(user: User | null | undefined): Entitlement {
  const edu = readEduStatus(user)
  return {
    plan: edu.verified ? 'babson' : 'free',
    isPro: edu.verified,
    edu,
  }
}

export function useEntitlement(): Entitlement {
  const { user } = useAuth()
  return React.useMemo(() => entitlementFor(user), [user])
}
