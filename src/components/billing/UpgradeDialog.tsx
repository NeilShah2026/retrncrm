import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, GraduationCap, Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useSubscription } from '@/hooks/useSubscription'
import { FREE_CONTACT_LIMIT, INTRO_OFFER, planById } from '@/lib/billing/plans'
import { FEATURE_COPY, requiredPlan, type Feature } from '@/lib/billing/features'
import { isWebBilling, startCheckout } from '@/lib/billing/web'
import { ROUTES } from '@/lib/routes'
import { track } from '@/lib/analytics'

const PERKS = [
  'Unlimited contacts',
  'Voice and photo capture',
  'Recruiting pipeline and reminders',
  'Reconnect suggestions',
]

/**
 * What a free account sees on reaching FREE_CONTACT_LIMIT — opened by the app
 * whenever the database refuses a 31st contact (see lib/billing/contactLimit),
 * or from Settings as a preview.
 *
 * On the website it leads with the intro offer, bought through Stripe. In the
 * iPhone app there's no Stripe (App Store rules), so it points to the
 * Subscription screen instead, which sells through the App Store.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  preview = false,
  feature,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened from Settings to check how it looks. Buttons still work. */
  preview?: boolean
  /** The paid feature they reached, when that's what opened this. */
  feature?: Feature
}) {
  const navigate = useNavigate()
  const { edu, isStudent } = useEntitlement()
  const { web } = useSubscription()
  const [busy, setBusy] = React.useState(false)

  const student = planById('student')!
  const standard = planById('standard')!
  const regular = student.prices!.monthly.display
  const standardPrice = standard.prices!.monthly.display
  // A Standard-only feature can't be answered with the Student plan.
  const standardOnly = feature ? requiredPlan(feature) === 'standard' : false
  // Student pricing is only sold to a verified school email, and the intro
  // offer only to first-time subscribers (Stripe would refuse it anyway).
  const offer = isWebBilling && isStudent && !web.hasSubscribedBefore && !standardOnly

  React.useEffect(() => {
    if (!open || preview) return
    track('upgrade_prompt_shown', { reason: feature ?? 'contact_limit', is_student: isStudent })
  }, [open, preview, feature, isStudent])

  async function claim(plan: 'student' | 'standard' = INTRO_OFFER.plan) {
    setBusy(true)
    try {
      await startCheckout(plan, INTRO_OFFER.period, { offer: offer && plan === INTRO_OFFER.plan })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t open checkout.')
      setBusy(false)
    }
  }

  function go(to: string) {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {preview && (
            <span className="w-fit rounded-sm border px-1.5 py-px text-xs font-medium text-muted-foreground">
              Preview
            </span>
          )}
          <DialogTitle>
            {feature ? FEATURE_COPY[feature].title : `You’ve reached ${FREE_CONTACT_LIMIT} contacts`}
          </DialogTitle>
          <DialogDescription>
            {feature
              ? FEATURE_COPY[feature].description
              : `The free plan holds ${FREE_CONTACT_LIMIT} people. Upgrade to keep adding everyone you meet.`}
          </DialogDescription>
        </DialogHeader>

        {offer ? (
          <div className="rounded-lg border border-brand/30 bg-brand/[0.06] p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Limited offer
            </p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="tnum text-3xl font-semibold tracking-[-0.02em]">
                {INTRO_OFFER.display}
              </span>
              <span className="text-sm text-muted-foreground">/month</span>
              <span className="tnum ml-1 text-sm text-muted-foreground line-through">{regular}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Student plan for your first {INTRO_OFFER.months} months, then {regular}/month.
              Cancel anytime.
            </p>
          </div>
        ) : isStudent && !standardOnly ? (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Student</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="tnum text-2xl font-semibold tracking-[-0.02em]">{regular}</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </p>
          </div>
        ) : (
          // No school email on file: Standard is what they can actually buy,
          // with the student route offered underneath.
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Standard</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="tnum text-2xl font-semibold tracking-[-0.02em]">{standardPrice}</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </p>
            {!standardOnly && (
              <p className="mt-2 text-xs text-muted-foreground">
                A student? Verify a .edu email for the Student plan at {regular}/month —{' '}
                {INTRO_OFFER.display}/month for your first {INTRO_OFFER.months}.
              </p>
            )}
            {standardOnly && (
              <p className="mt-2 text-xs text-muted-foreground">
                This one is on Standard — the Student plan doesn’t include it.
              </p>
            )}
          </div>
        )}

        <ul className="space-y-1.5">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-sm text-text-secondary">
              <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
              {perk}
            </li>
          ))}
        </ul>

        <div className="space-y-2 pt-1">
          {isWebBilling && isStudent && !standardOnly ? (
            <Button className="w-full" disabled={busy} onClick={() => void claim()}>
              {busy && <Loader2 className="animate-spin" />}
              {offer ? `Get Student for ${INTRO_OFFER.display}/month` : `Upgrade to Student — ${regular}/month`}
            </Button>
          ) : isWebBilling ? (
            <>
              <Button className="w-full" disabled={busy} onClick={() => void claim('standard')}>
                {busy && <Loader2 className="animate-spin" />}
                Upgrade to Standard — {standardPrice}/month
              </Button>
              {!standardOnly && (
                <Button variant="outline" className="w-full" onClick={() => go(ROUTES.settings)}>
                  <GraduationCap />
                  I’m a student — verify my .edu
                </Button>
              )}
            </>
          ) : (
            <Button className="w-full" onClick={() => go(ROUTES.subscription)}>
              See plans
            </Button>
          )}
          <div className="flex items-center justify-between gap-2">
            {isWebBilling ? (
              <Button variant="ghost" size="sm" onClick={() => go(ROUTES.subscription)}>
                Compare all plans
              </Button>
            ) : (
              <span />
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
          </div>
        </div>

        {!edu.verified && (
          <button
            type="button"
            onClick={() => go(ROUTES.settings)}
            className="flex items-start gap-2 rounded-md border-t pt-3 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <GraduationCap className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Babson student?</span> A verified
              @babson.edu email makes every paid feature free.
            </span>
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
