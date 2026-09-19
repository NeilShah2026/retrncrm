import * as React from 'react'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useUI } from '@/context/ui-context'
import { planAllows, type Feature } from '@/lib/billing/features'

/**
 * "May they use this, and if not, say so."
 *
 * `can` is for rendering (a lock on a button, a hidden panel); `require`
 * is for doing — it opens the upgrade prompt and returns false, so a handler
 * reads as `if (!require('pipeline')) return`.
 */
export function useFeatureGate(): {
  can: (feature: Feature) => boolean
  require: (feature: Feature) => boolean
} {
  const { plan } = useEntitlement()
  const { openUpgrade } = useUI()

  const can = React.useCallback((feature: Feature) => planAllows(plan, feature), [plan])

  const require = React.useCallback(
    (feature: Feature) => {
      if (can(feature)) return true
      openUpgrade({ feature })
      return false
    },
    [can, openUpgrade],
  )

  return { can, require }
}
