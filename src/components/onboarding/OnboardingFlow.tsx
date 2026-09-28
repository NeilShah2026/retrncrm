import * as React from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { AppMark, CapsuleButton } from '@/components/ui/capsule'
import { SubscriptionLegal } from '@/components/billing/SubscriptionLegal'
import {
  PANES,
  TOUR,
  firstName,
  useOfferActions,
  useOnboardingFlow,
} from '@/components/onboarding/shared'
import { OnboardingDesktop } from '@/components/onboarding/OnboardingDesktop'
import { useIsMobile } from '@/hooks/useIsMobile'
import { isPurchaseSurface } from '@/lib/billing/store'
import { selectionFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { isWebBilling } from '@/lib/billing/web'

/**
 * Onboarding: your name, what Retrn does, and the offer.
 *
 * Three panes, kept short on purpose. The name is the only thing asked, and
 * it is asked first because it is the one thing the app can't work out on its
 * own. What Retrn does is shown in three lines rather than explained — the
 * app itself is the better tour.
 */

export function OnboardingFlow() {
  const isMobile = useIsMobile()
  // A laptop gets a flow built for a laptop — same panes, same writes, a
  // layout that isn't a phone screen stretched across a monitor.
  if (!isMobile) return <OnboardingDesktop />
  return <PhoneOnboarding />
}

function PhoneOnboarding() {
  const { pane, index, back, go, finish, name, setName, nameReady, savingName, submitName } =
    useOnboardingFlow()

  return (
    // `h-[100dvh]`, not `min-h`: the pinned action at the foot of every pane
    // has to stay on screen, so the pane's own body is the only thing that
    // may scroll.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <Chrome
        step={index}
        total={PANES.length}
        onBack={pane === 'tour' ? () => go(-1) : undefined}
        // No skip on the name pane: the name is the one thing we ask for.
        onSkip={pane === 'tour' ? () => finish() : undefined}
      />

      <div
        key={pane}
        className={cn('flex min-h-0 flex-1 flex-col', back ? 'pane-in-back' : 'pane-in')}
      >
        {pane === 'name' && (
          <NamePane
            name={name}
            onChange={setName}
            ready={nameReady}
            saving={savingName}
            onSubmit={() => void submitName()}
          />
        )}

        {pane === 'tour' && <Tour name={name} onNext={() => go(1)} />}

        {pane === 'offer' && (
          <Offer onDone={() => finish()} onSeeAllPlans={() => finish(ROUTES.subscription)} />
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

function NamePane({
  name,
  onChange,
  ready,
  saving,
  onSubmit,
}: {
  name: string
  onChange: (name: string) => void
  ready: boolean
  saving: boolean
  onSubmit: () => void
}) {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) onSubmit()
      }}
    >
      <Pane
        center
        footer={
          <CapsuleButton type="submit" variant="dark" disabled={!ready} loading={saving}>
            Continue
          </CapsuleButton>
        }
      >
        <AppMark />
        <h1 className="text-ios-large-title mt-8 text-center leading-[1.05] tracking-[-0.03em]">
          Welcome to Retrn.
        </h1>
        <p className="text-ios-body mt-3 text-center text-text-secondary">
          What should we call you?
        </p>
        <input
          // Focusing it straight away is the point of the pane — the keyboard
          // coming up says "type here" without a word of copy.
          autoFocus
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={80}
          className={cn(
            'text-ios-body mt-8 h-[52px] w-full rounded-[14px] bg-bg-elevated px-4 text-center',
            'ring-1 ring-inset ring-border/70 placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-[1.5px] focus:ring-brand',
          )}
        />
      </Pane>
    </form>
  )
}

function Tour({ name, onNext }: { name: string; onNext: () => void }) {
  const first = firstName(name)
  return (
    <Pane center footer={<CapsuleButton variant="dark" onClick={onNext}>Continue</CapsuleButton>}>
      <h2 className="text-ios-title leading-[1.15]">
        {first ? `Nice to meet you, ${first}.` : 'Nice to meet you.'}
      </h2>
      <p className="text-ios-subhead mt-2 text-text-secondary">Here’s what Retrn does.</p>

      <ul className="mt-7 space-y-3">
        {TOUR.map(({ icon: Icon, title, detail }, i) => (
          <li
            key={title}
            style={{ animationDelay: `${i * 60}ms` }}
            className="turn-in flex items-center gap-3.5 rounded-[14px] bg-bg-elevated px-4 py-3.5 ring-1 ring-inset ring-border/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand/[0.09] text-brand">
              <Icon className="h-[20px] w-[20px]" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="text-ios-body block font-medium">{title}</span>
              <span className="text-ios-footnote block text-muted-foreground">{detail}</span>
            </span>
          </li>
        ))}
      </ul>
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
            disabled={busy || (!canPurchase && !needsEdu)}
            onClick={() => (needsEdu ? onSeeAllPlans() : void buy())}
          >
            {needsEdu
              ? 'See plans'
              : canPurchase
                ? `Start Student — ${yearly.display}/year`
                : 'Available at launch'}
          </CapsuleButton>
          {needsEdu && (
            <p className="text-ios-caption px-4 text-center text-muted-foreground">
              Student pricing is for verified students — verify a .edu email in Settings.
            </p>
          )}
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
