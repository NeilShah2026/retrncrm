import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/**
 * The auto-renewal disclosure, and the two links Apple requires next to it.
 *
 * App Review Guideline 3.1.2 wants these facts *in the app*, on any screen
 * that can start a subscription — not only in the App Store listing. There is
 * more than one such screen (the paywall and the last step of onboarding), so
 * the wording lives here once: two copies of a legal notice are two copies to
 * keep in step, and the one that goes stale is the one review reads.
 */
export function SubscriptionLegal({ className }: { className?: string }) {
  return (
    <p className={cn('text-ios-caption leading-relaxed text-muted-foreground', className)}>
      Payment is charged to your Apple Account at confirmation of purchase. The subscription
      renews automatically for the same period at the same price unless it is cancelled at least
      24 hours before the end of the current period. Manage or cancel any time in your Apple
      Account settings. See the{' '}
      <Link to={ROUTES.terms} className="text-brand">
        Terms of Use
      </Link>{' '}
      and{' '}
      <Link to={ROUTES.privacy} className="text-brand">
        Privacy Policy
      </Link>
      .
    </p>
  )
}
