import * as React from 'react'
import { toast } from 'sonner'
import {
  CaptureVignette,
  PipelineVignette,
  ReconnectVignette,
} from '@/components/onboarding/panes'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useSubscription } from '@/hooks/useSubscription'
import { tagRepo } from '@/services'
import {
  CADENCE_QUESTION,
  FOCUS_QUESTION,
  PLACE_QUESTION,
  STAGE_QUESTION,
  tagsToCreate,
  type OnboardingAnswers,
  type OnboardingQuestion,
} from '@/lib/onboarding'
import { planById, monthlyEquivalent } from '@/lib/billing/plans'
import { BillingUnavailableError, purchase, restorePurchases } from '@/lib/billing/store'
import { isWebBilling, startCheckout } from '@/lib/billing/web'
import { errorFeedback, successFeedback } from '@/lib/haptics'
import type { Tag } from '@/types'
import type { TagDraft } from '@/services/types'

/**
 * What the two onboarding flows — the phone's and the laptop's — have in
 * common: the order of the panes, the words on them, and the two pieces of
 * real work they do (writing the answers, and buying).
 *
 * The layouts themselves stay apart on purpose. A first-run flow is the one
 * screen where the shape of the device matters most: a phone wants one idea
 * per full-height pane with a thumb-reachable action, and a laptop wants a
 * held card with the illustration beside the text, keyboard support and no
 * pretend safe areas. Sharing the markup would mean one of them always
 * looking like a translation of the other — which is the thing being fixed.
 */

export type PaneId =
  | 'welcome'
  | 'capture'
  | 'reconnect'
  | 'pipeline'
  | 'focus'
  | 'stage'
  | 'place'
  | 'cadence'
  | 'tailoring'
  | 'offer'

export const PANES: PaneId[] = [
  'welcome',
  'capture',
  'reconnect',
  'pipeline',
  'focus',
  'stage',
  'place',
  'cadence',
  'tailoring',
  'offer',
]

export const QUESTION_PANES: Partial<Record<PaneId, OnboardingQuestion<never>>> = {
  focus: FOCUS_QUESTION as OnboardingQuestion<never>,
  stage: STAGE_QUESTION as OnboardingQuestion<never>,
  place: PLACE_QUESTION as OnboardingQuestion<never>,
  cadence: CADENCE_QUESTION as OnboardingQuestion<never>,
}

export const FEATURES: Record<
  'capture' | 'reconnect' | 'pipeline',
  { eyebrow: string; title: string; body: string; visual: React.ReactNode }
> = {
  capture: {
    eyebrow: 'Capture',
    title: 'One line is the whole ask.',
    body: 'Type or say who you met. Retrn turns it into a real record — name, company, where you met, and what to do next.',
    visual: <CaptureVignette />,
  },
  reconnect: {
    eyebrow: 'Follow up',
    title: 'The follow-up is the whole game.',
    body: 'Put a reconnect goal on anyone. Retrn tells you who is slipping, and reminds you what you last talked about before you reach out.',
    visual: <ReconnectVignette />,
  },
  pipeline: {
    eyebrow: 'Follow through',
    title: 'From coffee chat to offer.',
    body: 'Track every application on a board, and link the people who can move it forward. The network and the search stop being two separate things.',
    visual: <PipelineVignette />,
  },
}

// ---------------------------------------------------------------------------
// The tailoring step
// ---------------------------------------------------------------------------

export type StepState = 'pending' | 'running' | 'done' | 'failed'

export interface TailoringRun {
  saveState: StepState
  tagState: StepState
  /** Names of the tags this run actually created. */
  created: string[]
  /** Both writes have settled, one way or the other. */
  finished: boolean
  /** Neither write landed — the screen must not claim to be set up. */
  failed: boolean
  /** What the tag line should say right now. */
  tagLabel: string
}

/**
 * Where the four answers stop being a survey.
 *
 * Both steps are real writes, awaited in order, and each state only advances
 * when its own write has returned. If one fails it says so and the flow
 * continues — a tag that didn't get created is not a reason to trap someone
 * on a setup screen, and silently showing a checkmark over a failure would be
 * worse than either.
 */
export function useTailoringRun({
  answers,
  existingTags,
  onSave,
}: {
  answers: OnboardingAnswers
  /** `undefined` until the account's tags have loaded — see the guard below. */
  existingTags: Tag[] | undefined
  onSave: (prefs: OnboardingAnswers & { onboarded: boolean }) => Promise<{ error: string | null }>
}): TailoringRun {
  const [saveState, setSaveState] = React.useState<StepState>('pending')
  const [tagState, setTagState] = React.useState<StepState>('pending')
  const [created, setCreated] = React.useState<string[]>([])
  const finished =
    saveState !== 'pending' &&
    saveState !== 'running' &&
    tagState !== 'pending' &&
    tagState !== 'running'

  const draftsRef = React.useRef<TagDraft[] | null>(null)
  const ranRef = React.useRef(false)

  /**
   * Whether this is still on screen — as opposed to whether *an effect run*
   * is still current.
   *
   * These are not the same thing, and conflating them is what used to wedge
   * this screen. The work below must start exactly once (it writes rows), so
   * it is latched behind `ranRef`. But a plain `let alive` in the same effect
   * is cancelled by any *re-run* of that effect — StrictMode's remount in
   * development, or simply a parent re-render in production — and the latch
   * then stops the re-run from starting replacement work. The result was an
   * account that saved correctly behind a screen that said "Setting up…"
   * forever, with its Continue button disabled.
   */
  const mountedRef = React.useRef(true)
  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Props are read through refs so that neither a new `onSave` identity nor a
  // new `answers` object can re-trigger (or cancel) work that runs once.
  const answersRef = React.useRef(answers)
  answersRef.current = answers
  const onSaveRef = React.useRef(onSave)
  onSaveRef.current = onSave
  const tagsRef = React.useRef(existingTags)
  tagsRef.current = existingTags

  /**
   * Knowing the existing tags is worth a short wait — it is what stops a
   * second run through onboarding re-creating the first run's tags — but it
   * is not worth blocking on. A tag load that fails stays `undefined` for
   * good (see useData), so waiting for it unconditionally is another way to
   * hang this screen. After a moment, go ahead without it: the worst case is
   * a duplicate tag, which is a great deal better than a dead screen.
   */
  const [waitedForTags, setWaitedForTags] = React.useState(false)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setWaitedForTags(true), 2500)
    return () => window.clearTimeout(timer)
  }, [])
  const ready = existingTags !== undefined || waitedForTags

  React.useEffect(() => {
    if (!ready || ranRef.current) return
    // Creating a person's tags twice is duplicate rows in their account, so
    // the run-once latch is real code, not a development workaround.
    ranRef.current = true

    const answersNow = answersRef.current
    draftsRef.current = tagsToCreate(answersNow, tagsRef.current ?? [])

    void (async () => {
      setSaveState('running')
      const { error } = await onSaveRef.current({ ...answersNow, onboarded: true })
      if (!mountedRef.current) return
      setSaveState(error ? 'failed' : 'done')

      setTagState('running')
      const made: string[] = []
      let failed = false
      for (const draft of draftsRef.current ?? []) {
        try {
          await tagRepo.create(draft)
          made.push(draft.name)
        } catch {
          failed = true
        }
      }
      if (!mountedRef.current) return
      setCreated(made)
      setTagState(failed && made.length === 0 ? 'failed' : 'done')
    })()
  }, [ready])

  const drafts = draftsRef.current ?? []
  const tagLabel =
    tagState === 'done' && created.length === 0
      ? 'Your tags were already set up'
      : created.length > 0
        ? `Added ${created.length} ${created.length === 1 ? 'tag' : 'tags'}: ${created.join(', ')}`
        : drafts.length > 0
          ? `Adding ${drafts.length} tags`
          : 'Checking your tags'

  return {
    saveState,
    tagState,
    created,
    finished,
    failed: saveState === 'failed' && tagState === 'failed',
    tagLabel,
  }
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
