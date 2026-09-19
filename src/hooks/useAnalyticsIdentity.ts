import * as React from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useEntitlement } from '@/hooks/useEntitlement'
import { identifyUser, track } from '@/lib/analytics'

/**
 * Tie analytics to the signed-in account: the Supabase user id, plus the few
 * properties worth splitting a funnel by. Deliberately no email and no name —
 * see the note at the top of lib/analytics.ts.
 *
 * Re-identifies when the plan changes, so "upgraded" is visible in the person
 * properties without another event.
 */
export function useAnalyticsIdentity(): void {
  const { user } = useAuth()
  const { plan, isPro, isStudent, edu } = useEntitlement()
  const announced = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!user) return
    identifyUser(user, {
      plan,
      is_paid: isPro,
      is_student: isStudent,
      edu_verified: edu.student,
    })
    // Once per signed-in account per session, not on every plan change.
    if (announced.current !== user.id) {
      announced.current = user.id
      track('signed_in', { plan })
    }
  }, [user, plan, isPro, isStudent, edu.student])
}
