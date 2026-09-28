import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BellRing, SquareKanban, UserPlus, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useSubscription } from '@/hooks/useSubscription'
import { initialName } from '@/lib/onboarding'
import { planById, monthlyEquivalent } from '@/lib/billing/plans'
import { BillingUnavailableError, purchase, restorePurchases } from '@/lib/billing/store'
import { isWebBilling, startCheckout } from '@/lib/billing/web'
import { errorFeedback, successFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { track } from '@/lib/analytics'

/**
 * What the two onboarding flows — the phone's and the laptop's — have in
 * common: the order of the panes, the words on them, and the real work they
 * do (saving the name, finishing, and buying).
 *
 * The layouts themselves stay apart on purpose. A phone wants one idea per
 * full-height pane with a thumb-reachable action; a laptop wants a held card
 * with keyboard support. Sharing the markup would make one of them look like
 * a translation of the other.
 */

export type PaneId = 'name' | 'tour' | 'offer'

export const PANES: PaneId[] = ['name', 'tour', 'offer']

export const TOUR: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: UserPlus, title: 'Add anyone in one line', detail: 'Type or say who you met.' },
  { icon: BellRing, title: 'Know when to reach out', detail: 'Get nudged before they go cold.' },
  { icon: SquareKanban, title: 'Track the search', detail: 'Applications, next to the people.' },
]

/** The first word of the name, for addressing someone on the next pane. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/**
 * The flow's state and its writes, shared by both layouts.
 *
 * The name is saved the moment it is submitted, and again when the flow
 * finishes (or is skipped) — so a save that fails on a bad connection gets a
 * second chance instead of leaving the account nameless.
 */
export function useOnboardingFlow() {
  const navigate = useNavigate()
  const { user, updateName, saveOnboarding } = useAuth()

  const [index, setIndex] = React.useState(0)
  const [back, setBack] = React.useState(false)
  const [name, setName] = React.useState(() => initialName(user))
  const [savingName, setSavingName] = React.useState(false)

  const pane = PANES[index]
  // Read inside `finish`, which must not be re-created as panes change.
  const paneRef = React.useRef(pane)
  paneRef.current = pane
  const nameRef = React.useRef(name)
  nameRef.current = name

  const go = React.useCallback((delta: number) => {
    setBack(delta < 0)
    setIndex((i) => Math.min(PANES.length - 1, Math.max(0, i + delta)))
  }, [])

  /**
   * Leaving early still counts as onboarded. The alternative — reopening this
   * flow at every launch until it is completed — punishes the person who
   * already knows what the app is.
   */
  const finish = React.useCallback(
    (to: string = ROUTES.dashboard) => {
      track(paneRef.current === 'offer' ? 'onboarding_completed' : 'onboarding_skipped', {
        pane: paneRef.current,
      })
      const fullName = nameRef.current.trim()
      void saveOnboarding({
        ...(fullName && { full_name: fullName }),
        onboarded: true,
        onboardedAt: new Date().toISOString(),
      })
      // `replace`, so the back gesture from the app doesn't land someone on
      // the welcome screen they just finished.
      navigate(to, { replace: true })
    },
    [navigate, saveOnboarding],
  )

  const nameReady = name.trim().length > 0 && !savingName

  const submitName = React.useCallback(async () => {
    const trimmed = nameRef.current.trim()
    if (!trimmed) return
    setSavingName(true)
    const { error } = await updateName(trimmed)
    setSavingName(false)
    // Not a reason to hold someone on this pane: `finish` writes it again.
    if (error) console.warn('[onboarding] name save failed; retrying at finish', error)
    go(1)
  }, [go, updateName])

  return { pane, index, back, go, finish, name, setName, nameReady, savingName, submitName }
}

// ---------------------------------------------------------------------------
// The offer
// ---------------------------------------------------------------------------

/**
 * Buying from the last pane: Stripe Checkout on the web, the App Store in the
 * app, and the two things that are true before either — whether this account
 * is already covered, and whether it may buy the Student plan at all.
 */
export function useOfferActions(onDone: () => void) {
  const { isPro, isStudent, edu } = useEntitlement()
  const { canPurchase } = useSubscription()
  const [busy, setBusy] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)

  const student = planById('student')!
  const yearly = student.prices!.yearly

  async function buy() {
    setBusy(true)
    try {
      if (isWebBilling) {
        // On to Stripe Checkout; the page leaves, so there's nothing after.
        await startCheckout('student', 'yearly')
        return
      }
      await purchase(yearly.appStoreProductId!)
      successFeedback()
      toast.success('You’re subscribed. Everything is on.')
      onDone()
    } catch (err) {
      if (err instanceof BillingUnavailableError) {
        toast.info('Subscriptions open when Retrn lands on the App Store.')
      } else if (isWebBilling) {
        toast.error(err instanceof Error ? err.message : 'Couldn’t open checkout.')
      } else if (!String(err).toLowerCase().includes('cancel')) {
        errorFeedback()
        toast.error('That purchase didn’t go through.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    setRestoring(true)
    try {
      const state = await restorePurchases()
      if (state.active) {
        successFeedback()
        toast.success('Subscription restored.')
        onDone()
      } else {
        toast.info('No previous purchase found for this Apple ID.')
      }
    } catch {
      toast.info('Nothing to restore yet.')
    } finally {
      setRestoring(false)
    }
  }

  return {
    isPro,
    /** Student pricing is only sold against a verified school email. */
    needsEdu: !isStudent,
    edu,
    canPurchase,
    student,
    yearly,
    perMonth: monthlyEquivalent(yearly) ?? '',
    busy,
    restoring,
    buy,
    restore,
  }
}
