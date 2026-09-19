import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { SetupLine, Stage } from '@/components/onboarding/panes'
import { SubscriptionLegal } from '@/components/billing/SubscriptionLegal'
import {
  FEATURES,
  PANES,
  QUESTION_PANES,
  useOfferActions,
  useTailoringRun,
} from '@/components/onboarding/shared'
import { useAuth } from '@/auth/AuthProvider'
import { useTags } from '@/hooks/useData'
import {
  cadenceLabel,
  readOnboardingAnswers,
  type OnboardingAnswers,
  type OnboardingQuestion,
} from '@/lib/onboarding'
import { isWebBilling } from '@/lib/billing/web'
import { isPurchaseSurface } from '@/lib/billing/store'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Tag } from '@/types'

/**
 * Onboarding on a laptop.
 *
 * Same ten panes and the same writes as the phone's flow (both live in
 * `shared.tsx`) — but built for the machine it's on rather than scaled up
 * from one that isn't. Three things make it a desktop screen instead of a
 * tall phone pane:
 *
 *  1. **A held card, not a full-bleed column.** A 100dvh flow with a pinned
 *     footer is a phone idea; on a monitor it leaves a metre of empty page
 *     around a 26rem strip of text. Here the pane is a card on a recessed
 *     ground, sized to the content.
 *  2. **The illustration sits beside the words**, because there is room for
 *     it to. On the phone it has to go underneath.
 *  3. **The keyboard works.** Enter or → continues, ← goes back, Esc skips,
 *     and 1–9 pick an answer — with the number shown on each option, so the
 *     shortcut is discoverable rather than folklore.
 */
export function OnboardingDesktop() {
  const navigate = useNavigate()
  const { user, saveOnboarding } = useAuth()
  const tags = useTags()

  const [index, setIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<OnboardingAnswers>(() =>
    readOnboardingAnswers(user),
  )
  const pane = PANES[index]

  const go = React.useCallback((delta: number) => {
    setIndex((i) => Math.min(PANES.length - 1, Math.max(0, i + delta)))
  }, [])

  /**
   * Leaving early still counts as onboarded. The alternative — reopening
   * this at every launch until it is completed — punishes the person who
   * already knows what the app is, and they are exactly the person who
   * skipped.
   */
  const finish = React.useCallback(
    (prefs: OnboardingAnswers = {}, to: string = ROUTES.dashboard) => {
      void saveOnboarding({ ...prefs, onboarded: true, onboardedAt: new Date().toISOString() })
      navigate(to, { replace: true })
    },
    [navigate, saveOnboarding],
  )

  const question = QUESTION_PANES[pane]

  const answer = React.useCallback(
    (key: keyof OnboardingAnswers, value: string) => {
      setAnswers((a) => ({ ...a, [key]: value }))
      // A beat, so the choice is visibly taken before the pane moves on.
      window.setTimeout(() => go(1), 220)
    },
    [go],
  )

  // The pane's own primary action, so Enter and the button agree on what
  // "continue" means here.
  const advance = React.useCallback(() => {
    if (pane === 'offer' || question) return
    go(1)
  }, [go, pane, question])

  const canGoBack = index > 0 && pane !== 'tailoring' && pane !== 'offer'
  const canSkip = pane !== 'tailoring' && pane !== 'offer'

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        advance()
        return
      }
      if (e.key === 'ArrowLeft' && canGoBack) {
        go(-1)
        return
      }
      if (e.key === 'Escape' && canSkip) {
        finish(answers)
        return
      }
      // 1–9 answer the question panes.
      if (question && /^[1-9]$/.test(e.key)) {
        const option = question.options[Number(e.key) - 1]
        if (option) answer(question.key, option.value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advance, answer, answers, canGoBack, canSkip, finish, go, question])

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-sunken">
      <header className="flex shrink-0 items-center justify-between gap-6 px-6 py-4">
        <Logo />
        <Progress step={index} total={PANES.length} />
        <div className="flex w-32 justify-end">
          {canSkip && (
            <Button variant="ghost" size="sm" onClick={() => finish(answers)}>
              Skip setup
              <Kbd>Esc</Kbd>
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-10 pt-2">
        <div
          key={pane}
          className="turn-in w-full max-w-3xl overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          {pane === 'welcome' && <Welcome onStart={() => go(1)} />}

          {(pane === 'capture' || pane === 'reconnect' || pane === 'pipeline') && (
            <Feature {...FEATURES[pane]} onNext={() => go(1)} onBack={() => go(-1)} />
          )}

          {question && (
            <Question
              question={question}
              selected={answers[question.key]}
              onSelect={(value) => answer(question.key, value)}
              onBack={canGoBack ? () => go(-1) : undefined}
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
      </main>
    </div>
  )
}

/** Segments rather than a bar: it says how many steps are left. */
function Progress({ step, total }: { step: number; total: number }) {
  if (step === 0) return <div className="flex-1" />
  return (
    <div className="flex flex-1 items-center justify-center gap-3">
      <div className="flex w-56 items-center gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-[3px] flex-1 rounded-full transition-colors duration-base',
              i < step && 'bg-foreground/35',
              i === step && 'bg-foreground',
              i > step && 'bg-foreground/[0.11]',
            )}
          />
        ))}
      </div>
      <span className="tnum text-xs text-muted-foreground">
        {step + 1} of {total}
      </span>
    </div>
  )
}

/** A keyboard hint, the way a desktop app labels its shortcuts. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none ml-1 rounded-sm border bg-bg-sunken px-1 font-mono text-[10px] leading-4 text-muted-foreground">
      {children}
    </kbd>
  )
}

/** The card's action row: back on the left, the primary on the right. */
function Actions({
  onBack,
  children,
  hint,
}: {
  onBack?: () => void
  /** The primary action. A question pane has none — choosing is the action. */
  children?: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t bg-bg-sunken/40 px-8 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft />
            Back
          </Button>
        )}
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="px-10 py-12 text-center">
        <p className="text-label text-muted-foreground">Welcome to Retrn</p>
        <h1 className="mx-auto mt-4 max-w-xl text-4xl font-semibold leading-[1.1] tracking-[-0.03em]">
          You met them. Now what?
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-text-secondary">
          Retrn keeps the people you meet, and tells you when to reach back out — so the
          conversation you had in September still counts in March.
        </p>

        {/* What the next three screens cover, so the flow announces its own
            length instead of asking for open-ended patience. */}
        <div className="mt-8 flex items-center justify-center gap-2.5">
          {['Capture', 'Follow up', 'Follow through'].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="h-1 w-1 rounded-full bg-border" aria-hidden />}
              <span className="text-xs text-muted-foreground">{label}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
      <Actions hint="About a minute — four questions, then you’re in.">
        <Button onClick={onStart}>
          Get started
          <Kbd>↵</Kbd>
        </Button>
      </Actions>
    </>
  )
}

function Feature({
  eyebrow,
  title,
  body,
  visual,
  onNext,
  onBack,
}: {
  eyebrow: string
  title: string
  body: string
  visual: React.ReactNode
  onNext: () => void
  onBack: () => void
}) {
  return (
    <>
      {/* Words and picture side by side — the one thing a phone pane can't do. */}
      <div className="grid gap-8 px-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center">
        <div>
          <p className="text-label text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{body}</p>
        </div>
        <Stage>{visual}</Stage>
      </div>
      <Actions onBack={onBack}>
        <Button onClick={onNext}>
          Continue
          <Kbd>↵</Kbd>
        </Button>
      </Actions>
    </>
  )
}

function Question({
  question,
  selected,
  onSelect,
  onBack,
}: {
  question: OnboardingQuestion<never>
  selected?: string
  onSelect: (value: string) => void
  onBack?: () => void
}) {
  return (
    <>
      <div className="px-10 py-10">
        <p className="text-label text-muted-foreground">{question.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
          {question.prompt}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{question.caption}</p>

        {/* Two columns: four options are one glance on a laptop, not a scroll. */}
        <div
          role="radiogroup"
          aria-label={question.prompt}
          className="mt-6 grid gap-2.5 sm:grid-cols-2"
        >
          {question.options.map((option, i) => {
            const active = selected === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(option.value)}
                className={cn(
                  'group flex items-start gap-3 rounded-lg border p-4 text-left',
                  'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  active
                    ? 'border-brand bg-brand/[0.06]'
                    : 'hover:border-border-strong hover:bg-accent/40',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-[11px] font-medium',
                    active
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'text-muted-foreground group-hover:border-border-strong',
                  )}
                >
                  {active ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {option.detail}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {/* No button: picking an option is what moves the flow on. */}
      <Actions onBack={onBack} hint="Pick one — or press its number." />
    </>
  )
}

function Tailoring({
  answers,
  existingTags,
  onSave,
  onDone,
}: {
  answers: OnboardingAnswers
  existingTags: Tag[] | undefined
  onSave: (prefs: OnboardingAnswers & { onboarded: boolean }) => Promise<{ error: string | null }>
  onDone: () => void
}) {
  const { saveState, tagState, finished, failed, tagLabel } = useTailoringRun({
    answers,
    existingTags,
    onSave,
  })

  return (
    <>
      <div className="px-10 py-10">
        <h2 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
          {!finished ? 'Setting up Retrn.' : failed ? 'That didn’t save.' : 'Retrn is set up.'}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {!finished
            ? 'One moment — this is writing to your account, not pretending to.'
            : failed
              ? 'Nothing was written. Carry on — you can set all of this from Settings, and running onboarding again will retry it.'
              : 'Everything below is already in your account. All of it is editable later.'}
        </p>

        <div className="mt-6 divide-y divide-border/50 rounded-lg border px-4 py-1">
          <SetupLine
            state={saveState}
            label={
              saveState === 'failed'
                ? 'Couldn’t save your answers'
                : 'Saved what you’re working toward'
            }
          />
          <SetupLine
            state={tagState}
            label={tagState === 'failed' ? 'Couldn’t add your tags' : tagLabel}
          />
        </div>

        {finished && !failed && (
          <div className="turn-in mt-3 rounded-lg bg-bg-sunken p-4">
            <p className="text-xs text-muted-foreground">From here on</p>
            <p className="mt-1 text-sm leading-snug">
              Everyone you add starts with a reconnect goal of{' '}
              <span className="font-semibold">{cadenceLabel(answers.cadence)}</span>
              {answers.cadence === 'none' ? '' : ', so nobody goes quiet without Retrn saying so'}.
            </p>
          </div>
        )}
      </div>
      <Actions>
        <Button disabled={!finished} onClick={onDone}>
          {finished ? (
            <>
              Continue
              <Kbd>↵</Kbd>
            </>
          ) : (
            <>
              <Loader2 className="animate-spin" />
              Setting up…
            </>
          )}
        </Button>
      </Actions>
    </>
  )
}

function Offer({ onDone, onSeeAllPlans }: { onDone: () => void; onSeeAllPlans: () => void }) {
  const {
    isPro,
    needsEdu,
    edu,
    canPurchase,
    student,
    yearly,
    perMonth,
    busy,
    restoring,
    buy,
    restore,
  } = useOfferActions(onDone)

  // Someone the Babson offer already covers must not be sold to. Showing a
  // price to a person who has been told they pay nothing is how you lose them.
  if (isPro) {
    return (
      <>
        <div className="px-10 py-12 text-center">
          <h2 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
            You’re already covered.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-text-secondary">
            {edu.verified
              ? 'Your verified Babson email gets every paid feature, free, for as long as it stays verified.'
              : 'Your subscription is active — everything in Retrn is on.'}
          </p>
        </div>
        <Actions>
          <Button onClick={onDone}>Start using Retrn</Button>
        </Actions>
      </>
    )
  }

  return (
    <>
      <div className="grid gap-8 px-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="text-label text-muted-foreground">Retrn Student</p>
          <h2 className="mt-2 text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
            Cheaper than the coffee.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
            A coffee chat costs you about six dollars and most of an afternoon. Retrn costs less
            than that per month — and it is the part that makes sure the afternoon was worth it.
          </p>

          {/* The comparison, made literally: side by side, so the two numbers
              are read against each other rather than one after the other. */}
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border">
            <div className="px-4 py-4">
              <p className="text-xs text-muted-foreground">One coffee chat</p>
              <p className="tnum mt-1.5 text-2xl font-medium leading-none text-text-muted">~$6</p>
              <p className="mt-2 text-xs leading-snug text-muted-foreground">
                Gone by the end of the week
              </p>
            </div>
            <div className="border-l px-4 py-4">
              <p className="text-xs text-text-secondary">Retrn, a month</p>
              <p className="tnum mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.02em]">
                $4.17
              </p>
              <p className="mt-2 text-xs leading-snug text-text-secondary">
                Every chat you’ve ever had, kept
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {yearly.display} per year — {perMonth}. Auto-renews until cancelled.
          </p>
        </div>

        <div>
          <ul className="space-y-2.5">
            {student.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <Check className="mt-px h-4 w-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {needsEdu && (
            <p className="mt-4 rounded-md bg-bg-sunken p-3 text-xs leading-relaxed text-muted-foreground">
              Student pricing is for verified students — verify a .edu email in Settings. Everyone
              else is on Standard.
            </p>
          )}
          <SubscriptionLegal className="mt-4 text-xs" />
          {!isPurchaseSurface() && !isWebBilling && (
            <p className="mt-3 text-xs text-muted-foreground">
              Subscriptions are purchased in the Retrn iPhone app.
            </p>
          )}
        </div>
      </div>

      <Actions
        hint={
          needsEdu ? (
            'Student pricing needs a verified .edu email.'
          ) : (
            <button type="button" onClick={onSeeAllPlans} className="text-brand hover:underline">
              See all plans
            </button>
          )
        }
      >
        {/* Restoring is an App Store idea; a web subscription is simply on the
            account wherever you sign in. */}
        {!isWebBilling && (
          <Button variant="ghost" size="sm" disabled={restoring} onClick={() => void restore()}>
            Restore
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDone}>
          Not now
        </Button>
        <Button
          disabled={busy || (!canPurchase && !needsEdu)}
          onClick={() => (needsEdu ? onSeeAllPlans() : void buy())}
        >
          {busy && <Loader2 className="animate-spin" />}
          {needsEdu
            ? 'See plans'
            : canPurchase
              ? `Start Student — ${yearly.display}/year`
              : 'Available at launch'}
          {!busy && !needsEdu && canPurchase && <ArrowRight />}
        </Button>
      </Actions>
    </>
  )
}
