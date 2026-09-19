import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, CalendarX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/useSubscription'
import { isWebBilling, openBillingPortal } from '@/lib/billing/web'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/** Statuses that mean Stripe is failing to collect. */
const FAILING = ['past_due', 'unpaid', 'incomplete']

const DISMISS_KEY = 'retrn-billing-notice-dismissed'

/**
 * The one strip above the app that says something is wrong with the money:
 * a card that failed, or a subscription that has been cancelled and is
 * running out. Both are invisible otherwise — access simply stops one day —
 * and both are recoverable from Stripe's billing portal.
 *
 * A failed payment can't be dismissed; a cancellation notice can, until the
 * tab is closed.
 */
export function BillingNotice() {
  const navigate = useNavigate()
  const { web } = useSubscription()
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === web.expiresAt
    } catch {
      return false
    }
  })

  const failing = Boolean(web.status && FAILING.includes(web.status))
  const ending = web.active && web.cancelAtPeriodEnd
  if (!failing && (!ending || dismissed)) return null

  function dismiss() {
    setDismissed(true)
    try {
      // Keyed to the date, so a later cancellation speaks up again.
      sessionStorage.setItem(DISMISS_KEY, web.expiresAt ?? '')
    } catch {
      // Not worth failing over.
    }
  }

  async function manage() {
    if (!isWebBilling) {
      navigate(ROUTES.subscription)
      return
    }
    try {
      await openBillingPortal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t open billing.')
    }
  }

  const when = web.expiresAt
    ? new Date(web.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 border-b px-4 py-2 text-sm md:px-6',
        failing ? 'bg-danger/10 text-danger' : 'bg-bg-sunken',
      )}
    >
      {failing ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : (
        <CalendarX className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <p className="min-w-0 flex-1">
        {failing ? (
          <>
            <span className="font-medium">Your payment didn’t go through.</span>{' '}
            <span className="text-danger/80">
              Update your card to keep your subscription — paid features stop when Stripe gives
              up retrying.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Your subscription is set to end{when ? ` on ${when}` : ''}.</span>{' '}
            <span className="text-muted-foreground">
              You keep everything until then; after that the free plan’s 30-contact limit applies
              again.
            </span>
          </>
        )}
      </p>
      <Button
        size="sm"
        variant={failing ? 'default' : 'outline'}
        className="shrink-0"
        onClick={() => void manage()}
      >
        {failing ? 'Update card' : isWebBilling ? 'Resume' : 'Manage'}
      </Button>
      {!failing && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
