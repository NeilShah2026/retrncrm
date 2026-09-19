import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { AppMark, CapsuleButton } from '@/components/ui/capsule'
import { SubscriptionLegal } from '@/components/billing/SubscriptionLegal'
import {
  CaptureVignette,
  PipelineVignette,
  ReconnectVignette,
  SetupLine,
  Stage,
} from '@/components/onboarding/panes'
import { useAuth } from '@/auth/AuthProvider'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useSubscription } from '@/hooks/useSubscription'
import { tagRepo } from '@/services'
import { useTags } from '@/hooks/useData'
import {
  CADENCE_QUESTION,
  FOCUS_QUESTION,
  PLACE_QUESTION,
  STAGE_QUESTION,
  cadenceLabel,
  readOnboardingAnswers,
  tagsToCreate,
  type OnboardingAnswers,
  type OnboardingQuestion,
} from '@/lib/onboarding'
import { planById, monthlyEquivalent } from '@/lib/billing/plans'
import type { Tag } from '@/types'
import type { TagDraft } from '@/services/types'
import {
  BillingUnavailableError,
  isPurchaseSurface,
  purchase,
  restorePurchases,
} from '@/lib/billing/store'
import { errorFeedback, selectionFeedback, successFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { isWebBilling, startCheckout } from '@/lib/billing/web'

/**
 * Onboarding: what Retrn is, four questions, and the offer.
 *
 * The shape is deliberate. Three things have to happen in the ninety seconds
 * a new account will give you, in this order, and none of them works out of
 * order:
 *
 *  1. **Show the product before asking for anything.** Three panes, one idea
 *     each, each illustrated with a true picture of the screen it describes.
 *     Nobody answers questions for software they have not seen.
 *  2. **Ask only questions that change something.** Four, all single-tap,
 *     each wired to a tag that gets created or a default that gets set — see
 *     the contract at the top of src/lib/onboarding.ts.
 *  3. **Then make the offer**, against the thing it is actually competing
 *     with. Not "unlimited contacts" — a coffee chat, which the person
 *     reading this has already decided is worth six dollars and an afternoon.
 *
 * The tailoring step in between is the hinge: it is where the four answers
 * become real objects in the account, and it reports only work that actually
 * finished. A progress screen that ticks boxes against nothing is the single
 * fastest way to teach someone that the rest of the app is also theatre.
 */

type PaneId =
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

const PANES: PaneId[] = [
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

const QUESTION_PANES: Partial<Record<PaneId, OnboardingQuestion<never>>> = {
  focus: FOCUS_QUESTION as OnboardingQuestion<never>,
  stage: STAGE_QUESTION as OnboardingQuestion<never>,
  place: PLACE_QUESTION as OnboardingQuestion<never>,
  cadence: CADENCE_QUESTION as OnboardingQuestion<never>,
}

const FEATURES: Record<
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

export function OnboardingFlow() {
  const navigate = useNavigate()
  const { user, saveOnboarding } = useAuth()
  const tags = useTags()

  const [index, setIndex] = React.useState(0)
  const [back, setBack] = React.useState(false)
  const [answers, setAnswers] = React.useState<OnboardingAnswers>(() =>
    readOnboardingAnswers(user),
  )

  const pane = PANES[index]

  const go = React.useCallback((delta: number) => {
    setBack(delta < 0)
    setIndex((i) => Math.min(PANES.length - 1, Math.max(0, i + delta)))
  }, [])

  /**
   * Leaving early still counts as onboarded. The alternative — reopening this
   * flow at every launch until it is completed — punishes the person who
   * already knows what the app is, and they are exactly the person who
   * skipped.
   */
  const finish = React.useCallback(
    (prefs: OnboardingAnswers = {}, to: string = ROUTES.dashboard) => {
      void saveOnboarding({ ...prefs, onboarded: true, onboardedAt: new Date().toISOString() })
      // `replace`, so the phone's back gesture from the app doesn't land
      // someone back at the welcome screen they just finished.
      navigate(to, { replace: true })
    },
    [navigate, saveOnboarding],
  )

  function answer(key: keyof OnboardingAnswers, value: string) {
    selectionFeedback()
    setAnswers((a) => ({ ...a, [key]: value }))
    // A beat, so the selection is visibly registered before the pane moves.
    // Without it the tap reads as "the screen jumped", not "that was taken".
    window.setTimeout(() => go(1), 260)
  }

  const question = QUESTION_PANES[pane]

  return (
    // `h-[100dvh]`, not `min-h`: the pinned action at the foot of every pane
    // has to stay on screen, so the pane's own body is the only thing that
    // may scroll. With a minimum height the document grows instead and the
    // button on a long pane (the offer) ends up below the fold.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <Chrome
        step={index}
        total={PANES.length}
        onBack={index > 0 && pane !== 'tailoring' ? () => go(-1) : undefined}
        onSkip={pane === 'tailoring' || pane === 'offer' ? undefined : () => finish(answers)}
      />

      <div
        key={pane}
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          back ? 'pane-in-back' : 'pane-in',
        )}
      >
        {pane === 'welcome' && <Welcome onStart={() => go(1)} />}

        {(pane === 'capture' || pane === 'reconnect' || pane === 'pipeline') && (
          <Feature {...FEATURES[pane]} onNext={() => go(1)} />
        )}

        {question && (
          <Question
            question={question}
            selected={answers[question.key]}
            onSelect={(value) => answer(question.key, value)}
          />
        )}

        {pane === 'tailoring' && (
          <Tailoring
            answers={answers}
            existingTags={tags}
            onSave={saveOnboarding}
            onDone={() => go(1)}
          />
        )}

        {pane === 'offer' && (
          <Offer
            onDone={() => finish(answers)}
            onSeeAllPlans={() => finish(answers, ROUTES.subscription)}
          />
        )}
      </div>
    </div>
  )
}

/** The bar every pane shares: back, progress, skip. */
function Chrome({
  step,
  total,
  onBack,
  onSkip,
}: {
  step: number
  total: number
  onBack?: () => void
  onSkip?: () => void
}) {
  return (
    <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div className="flex h-11 items-center justify-between">
        <div className="flex w-16 justify-start">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                selectionFeedback()
                onBack()
              }}
              aria-label="Back"
              className="press -ml-2 flex h-11 w-11 items-center justify-center text-text-secondary"
            >
              <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Progress as segments rather than a bar: it says how many steps are
            left, which a continuous bar only implies. */}
        <div className="flex flex-1 items-center justify-center gap-1" aria-hidden>
          {step > 0 &&
            Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-[3.5px] flex-1 rounded-full transition-colors duration-base',
                  i < step && 'bg-foreground/35',
                  i === step && 'bg-foreground',
                  i > step && 'bg-foreground/[0.11]',
                )}
              />
            ))}
        </div>

        <div className="flex w-16 justify-end">
          {onSkip && (
            <button
              type="button"
              onClick={() => {
                selectionFeedback()
                onSkip()
              }}
              className="press text-ios-subhead flex h-11 items-center px-1 text-muted-foreground"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The scrolling body plus the pinned action area every pane is built on. */
function Pane({
  children,
  footer,
  center,
}: {
  children: React.ReactNode
  /** The pinned action area. `null` for a pane whose options are the action. */
  footer: React.ReactNode
  /** Vertically centre the body — for the panes that are mostly type. */
  center?: boolean
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null)
  // A hairline over the pinned action, but only while there is something
  // still below the fold — the cue iOS puts on a toolbar that content runs
  // under. On a pane that fits, a rule floating above the button would be a
  // line drawn for no reason.
  const [cutOff, setCutOff] = React.useState(false)

  const measure = React.useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop
    setCutOff(remaining > 1)
  }, [])

  React.useEffect(() => {
    measure()
    const el = bodyRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measure])

  return (
    <>
      <div
        ref={bodyRef}
        onScroll={measure}
        className={cn(
          'scroll-native min-h-0 flex-1 overflow-y-auto px-6',
          center && 'flex flex-col justify-center',
        )}
      >
        <div className="mx-auto w-full max-w-[26rem] py-6">{children}</div>
      </div>
      {footer && (
        <div
          className={cn(
            'shrink-0 border-t px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3',
            cutOff ? 'border-border/70' : 'border-transparent',
          )}
        >
          <div className="mx-auto w-full max-w-[26rem] space-y-2.5">{footer}</div>
        </div>
      )}
    </>
  )
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <Pane
      center
      footer={<CapsuleButton variant="dark" onClick={onStart}>Get started</CapsuleButton>}
    >
      <AppMark />
      <h1 className="text-ios-large-title mt-8 text-center leading-[1.05] tracking-[-0.03em]">
        You met them.
        <br />
        Now what?
      </h1>
      <p className="text-ios-body mx-auto mt-4 max-w-[19rem] text-center leading-relaxed text-text-secondary">
        Retrn keeps the people you meet, and tells you when to reach back out — so the
        conversation you had in September still counts in March.
      </p>

      {/* What the next three screens cover, so the flow announces its own
          length instead of asking for open-ended patience. */}
      <div className="mt-9 flex items-center justify-center gap-2.5">
        {['Capture', 'Follow up', 'Follow through'].map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && <span className="h-1 w-1 rounded-full bg-border" aria-hidden />}
            <span className="text-ios-caption text-muted-foreground">{label}</span>
          </React.Fragment>
        ))}
      </div>
      <p className="text-ios-caption mt-3 text-center text-muted-foreground">
        About a minute.
      </p>
    </Pane>
  )
}

function Feature({
  eyebrow,
  title,
  body,
  visual,
  onNext,
}: {
  eyebrow: string
  title: string
  body: string
  visual: React.ReactNode
  onNext: () => void
}) {
  return (
    <Pane center footer={<CapsuleButton variant="dark" onClick={onNext}>Continue</CapsuleButton>}>
      <p className="text-label text-muted-foreground">{eyebrow}</p>
      <h2 className="text-ios-title mt-2 leading-[1.12]">{title}</h2>
      <p className="text-ios-subhead mt-3 text-text-secondary">{body}</p>
      <div className="mt-7">
        <Stage>{visual}</Stage>
      </div>
    </Pane>
  )
}

function Question({
  question,
  selected,
  onSelect,
}: {
  question: OnboardingQuestion<never>
  selected?: string
  onSelect: (value: string) => void
}) {
  return (
    <Pane center footer={null}>
      <p className="text-label text-muted-foreground">{question.eyebrow}</p>
      <h2 className="text-ios-title mt-2 leading-[1.15]">{question.prompt}</h2>
      <p className="text-ios-footnote mt-2 text-muted-foreground">{question.caption}</p>

      <div role="radiogroup" aria-label={question.prompt} className="mt-6 space-y-2.5">
        {question.options.map((option, i) => {
          const active = selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(option.value)}
              // `turn-in` is the house entrance (index.css); the small
              // per-row delay makes the list arrive as a list rather than as
              // one block, which is what an iOS table view does on push.
              style={{ animationDelay: `${i * 45}ms` }}
              className={cn(
                'turn-in press-scale flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 text-left',
                'ring-inset transition-[background-color,box-shadow] duration-fast',
                active
                  ? 'bg-brand/[0.07] ring-[1.5px] ring-brand'
                  : 'bg-bg-elevated ring-1 ring-border/70',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="text-ios-body block font-medium">{option.label}</span>
                <span className="text-ios-footnote mt-0.5 block text-muted-foreground">
                  {option.detail}
                </span>
              </span>
              {/* The same trailing checkmark a chosen row gets everywhere
                  else on the phone (ui/inset-list.tsx's InsetCheckRow). */}
              <Check
                aria-hidden
                strokeWidth={2.8}
                className={cn(
                  'h-[19px] w-[19px] shrink-0 text-brand transition-[opacity,transform] duration-base ease-[var(--ease-spring)]',
                  active ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                )}
              />
            </button>
          )
        })}
      </div>
    </Pane>
  )
}

type StepState = 'pending' | 'running' | 'done' | 'failed'

/**
 * Where the four answers stop being a survey.
 *
 * Both steps are real writes, awaited in order, and the line only ticks when
 * its own write has returned. If one fails it says so and the flow continues
 * — a tag that didn't get created is not a reason to trap someone on a setup
 * screen, and silently showing a checkmark over a failure would be worse than
 * either.
 */
function Tailoring({
  answers,
  existingTags,
  onSave,
  onDone,
}: {
  answers: OnboardingAnswers
  /** `undefined` until the account's tags have loaded — see the guard below. */
  existingTags: Tag[] | undefined
  onSave: (prefs: OnboardingAnswers & { onboarded: boolean }) => Promise<{ error: string | null }>
  onDone: () => void
}) {
  const [saveState, setSaveState] = React.useState<StepState>('pending')
  const [tagState, setTagState] = React.useState<StepState>('pending')
  const [created, setCreated] = React.useState<string[]>([])
  const finished =
    saveState !== 'pending' && saveState !== 'running' && tagState !== 'pending' && tagState !== 'running'

  const draftsRef = React.useRef<TagDraft[] | null>(null)
  const ranRef = React.useRef(false)

  /**
   * Whether this component is on screen — as opposed to whether *an effect
   * run* is still current.
   *
   * These are not the same thing, and conflating them is what used to wedge
   * this screen. The work below must start exactly once (it writes rows), so
   * it is latched behind `ranRef`. But a plain `let alive` in the same effect
   * is cancelled by any *re-run* of that effect — StrictMode's remount in
   * development, or simply a parent re-render in production — and the latch
   * then stops the re-run from starting replacement work. The result was an
   * account that saved correctly behind a screen that said "Setting up…"
   * forever, with its Continue button disabled.
   *
   * A ref tied to mount/unmount only, declared before the effect that reads
   * it, survives a re-run and is restored by a remount.
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

  return (
    <Pane
      center
      footer={
        <CapsuleButton variant="dark" disabled={!finished} onClick={onDone}>
          {finished ? 'Continue' : 'Setting up…'}
        </CapsuleButton>
      }
    >
      <h2 className="text-ios-title leading-[1.15]">
        {finished ? 'Retrn is set up.' : 'Setting up Retrn.'}
      </h2>
      <p className="text-ios-subhead mt-3 text-text-secondary">
        {finished
          ? 'Everything below is already in your account. All of it is editable later.'
          : 'One moment — this is writing to your account, not pretending to.'}
      </p>

      <div className="mt-6 divide-y divide-border/50 rounded-[14px] bg-bg-sunken px-4 py-1">
        <SetupLine
          state={saveState}
          label={saveState === 'failed' ? 'Couldn’t save your answers' : 'Saved what you’re working toward'}
        />
        <SetupLine
          state={tagState}
          label={tagState === 'failed' ? 'Couldn’t add your tags' : tagLabel}
        />
      </div>

      {finished && (
        <div className="turn-in mt-3 rounded-[14px] bg-bg-sunken p-4">
          <p className="text-ios-footnote text-muted-foreground">From here on</p>
          <p className="text-ios-subhead mt-1 leading-snug text-foreground">
            Everyone you add starts with a reconnect goal of{' '}
            <span className="font-semibold">{cadenceLabel(answers.cadence)}</span>
            {answers.cadence === 'none' ? '' : ', so nobody goes quiet without Retrn saying so'}.
          </p>
        </div>
      )}
    </Pane>
  )
}

/**
 * The close.
 *
 * It sells against a coffee chat rather than against a feature list, because
 * that is the real comparison: the person reading this has already decided a
 * coffee chat is worth six dollars and most of an afternoon. A year of Retrn
 * costs less than about nine of them, and its whole job is making sure those
 * afternoons were not wasted. That is a far better argument than "unlimited
 * contacts", and it is also true.
 */
function Offer({
  onDone,
  onSeeAllPlans,
}: {
  onDone: () => void
  onSeeAllPlans: () => void
}) {
  const { isPro, edu } = useEntitlement()
  const { canPurchase } = useSubscription()
  const [busy, setBusy] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)

  const student = planById('student')!
  const yearly = student.prices!.yearly
  const perMonth = monthlyEquivalent(yearly) ?? ''

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

  // Someone the Babson offer already covers must not be sold to. Showing a
  // price to a person who has been told they pay nothing is how you lose them.
  if (isPro) {
    return (
      <Pane
        center
        footer={<CapsuleButton variant="dark" onClick={onDone}>Start using Retrn</CapsuleButton>}
      >
        <h2 className="text-ios-title text-center leading-[1.15]">You’re already covered.</h2>
        <p className="text-ios-body mt-4 text-center text-text-secondary">
          {edu.verified
            ? 'Your verified Babson email gets every paid feature, free, for as long as it stays verified.'
            : 'Your subscription is active — everything in Retrn is on.'}
        </p>
      </Pane>
    )
  }

  return (
    <Pane
      footer={
        <>
          <CapsuleButton
            variant="dark"
            loading={busy}
            disabled={busy || !canPurchase}
            onClick={() => void buy()}
          >
            {canPurchase ? `Start Student — ${yearly.display}/year` : 'Available at launch'}
          </CapsuleButton>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={onSeeAllPlans}
              className="press text-ios-subhead py-2 text-brand"
            >
              See all plans
            </button>
            {/* Restoring is an App Store idea; a web subscription is simply
                on the account wherever you sign in. */}
            {!isWebBilling && (
              <button
                type="button"
                onClick={() => void restore()}
                disabled={restoring}
                className="press text-ios-subhead py-2 text-brand disabled:opacity-50"
              >
                Restore
              </button>
            )}
            <button
              type="button"
              onClick={onDone}
              className="press text-ios-subhead py-2 text-muted-foreground"
            >
              Not now
            </button>
          </div>
        </>
      }
    >
      <p className="text-label text-muted-foreground">Retrn Student</p>
      <h2 className="text-ios-title mt-2 leading-[1.15]">
        Cheaper than the coffee.
      </h2>
      <p className="text-ios-subhead mt-3 text-text-secondary">
        A coffee chat costs you about six dollars and most of an afternoon. Retrn costs less
        than that per month — and it is the part that makes sure the afternoon was worth it.
      </p>

      {/* The comparison, made literally: side by side, so the two numbers are
          read against each other rather than one after the other. The
          emphasis is type weight and size, not colour — the whole argument is
          that one of these is visibly smaller than the other. */}
      <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-[18px] bg-bg-sunken ring-1 ring-inset ring-border/60">
        {/* No strikethrough on the coffee: $4.17 is not a discount off $6,
            it is a different thing that costs less. The emphasis is carried
            by weight and size, which is the honest version of the claim. */}
        <div className="px-4 py-4">
          <p className="text-ios-caption text-muted-foreground">One coffee chat</p>
          <p className="tnum mt-1.5 text-[25px] font-medium leading-none text-text-muted">~$6</p>
          <p className="text-ios-caption mt-2 leading-snug text-muted-foreground">
            Gone by the end of the week
          </p>
        </div>
        <div className="border-l border-border/60 px-4 py-4">
          <p className="text-ios-caption text-text-secondary">Retrn, a month</p>
          <p className="tnum mt-1.5 text-[31px] font-semibold leading-none tracking-[-0.02em] text-foreground">
            $4.17
          </p>
          <p className="text-ios-caption mt-2 leading-snug text-text-secondary">
            Every chat you’ve ever had, kept
          </p>
        </div>
      </div>

      <p className="text-ios-caption mt-2.5 px-1 text-muted-foreground">
        {yearly.display} per year — {perMonth}. Auto-renews until cancelled.
      </p>

      <ul className="mt-7 space-y-2.5">
        {student.features.map((f, i) => (
          <li
            key={f}
            style={{ animationDelay: `${i * 40}ms` }}
            className="turn-in text-ios-footnote flex items-start gap-2.5 text-text-secondary"
          >
            <Check className="mt-px h-4 w-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden />
            {f}
          </li>
        ))}
      </ul>

      <SubscriptionLegal className="mt-6" />

      {!isPurchaseSurface() && (
        <p className="text-ios-caption mt-3 text-muted-foreground">
          Subscriptions are purchased in the Retrn iPhone app.
        </p>
      )}
    </Pane>
  )
}
