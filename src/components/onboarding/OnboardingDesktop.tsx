import * as React from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubscriptionLegal } from '@/components/billing/SubscriptionLegal'
import {
  PANES,
  TOUR,
  firstName,
  useOfferActions,
  useOnboardingFlow,
} from '@/components/onboarding/shared'
import { isWebBilling } from '@/lib/billing/web'
import { isPurchaseSurface } from '@/lib/billing/store'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/**
 * Onboarding on a laptop.
 *
 * Same three panes and the same writes as the phone's flow (both live in
 * `shared.tsx`), laid out as a held card on a recessed ground rather than a
 * phone pane stretched across a monitor. The keyboard works: Enter continues,
 * ← goes back, Esc skips once the name is in.
 */
export function OnboardingDesktop() {
  const { pane, index, go, finish, name, setName, mustName, nameReady, savingName, submitName } =
    useOnboardingFlow()

  const canGoBack = pane === 'tour'
  // Sign in with Apple accounts may skip the name (see nameRequired).
  const canSkip = pane === 'tour' || (pane === 'name' && !mustName)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // The name pane is a form: Enter there is handled by its submit, and
      // arrows belong to the text field.
      if (pane === 'name') {
        if (e.key === 'Escape' && canSkip) finish()
        return
      }
      if (pane !== 'tour') return
      if (e.key === 'Enter' || e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft' && canGoBack) go(-1)
      else if (e.key === 'Escape' && canSkip) finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canGoBack, canSkip, finish, go, pane])

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-sunken">
      <header className="flex shrink-0 items-center justify-between gap-6 px-6 py-4">
        <Logo />
        <Progress step={index} total={PANES.length} />
        <div className="flex w-32 justify-end">
          {canSkip && (
            <Button variant="ghost" size="sm" onClick={() => finish()}>
              Skip
              <Kbd>Esc</Kbd>
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-10 pt-2">
        <div
          key={pane}
          className={cn(
            'turn-in w-full overflow-hidden rounded-xl border bg-card shadow-sm',
            pane === 'offer' ? 'max-w-3xl' : 'max-w-lg',
          )}
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

          {pane === 'tour' && <Tour name={name} onNext={() => go(1)} onBack={() => go(-1)} />}

          {pane === 'offer' && (
            <Offer onDone={() => finish()} onSeeAllPlans={() => finish(ROUTES.subscription)} />
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
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) onSubmit()
      }}
    >
      <div className="px-10 py-12 text-center">
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-[-0.03em]">
          Welcome to Retrn.
        </h1>
        <p className="mt-3 text-[15px] text-text-secondary">What should we call you?</p>
        <Input
          autoFocus
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="name"
          maxLength={80}
          className="mx-auto mt-7 h-11 max-w-xs text-center text-[15px]"
        />
      </div>
      <Actions>
        <Button type="submit" disabled={!ready}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Continue
              <Kbd>↵</Kbd>
            </>
          )}
        </Button>
      </Actions>
    </form>
  )
}

function Tour({
  name,
  onNext,
  onBack,
}: {
  name: string
  onNext: () => void
  onBack: () => void
}) {
  const first = firstName(name)
  return (
    <>
      <div className="px-10 py-10">
        <h2 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
          {first ? `Nice to meet you, ${first}.` : 'Nice to meet you.'}
        </h2>
        <p className="mt-2 text-[15px] text-text-secondary">Here’s what Retrn does.</p>

        <ul className="mt-6 space-y-2.5">
          {TOUR.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-center gap-3.5 rounded-lg border px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/[0.09] text-brand">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
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

function Offer({ onDone, onSeeAllPlans }: { onDone: () => void; onSeeAllPlans: () => void }) {
  const {
    isPro,
    needsEdu,
    edu,
    canPurchase,
    student,
    price,
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

          {/* The price as billed is the biggest number here — Guideline
              3.1.2 — with the per-month figure beneath it, never above it. */}
          <div className="mt-6 rounded-lg border px-4 py-4">
            <p className="flex items-baseline gap-1.5">
              <span className="tnum text-[28px] font-semibold leading-none tracking-[-0.02em]">
                {price}
              </span>
              <span className="text-sm text-text-secondary">per year</span>
            </p>
            <p className="mt-2 text-xs leading-snug text-text-secondary">
              {perMonth ? `${perMonth} — less than one coffee chat a month.` : '1 year, auto-renewing.'}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Renews every year at {price} until cancelled.
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
              ? `Start Student — ${price}/year`
              : 'Available at launch'}
          {!busy && !needsEdu && canPurchase && <ArrowRight />}
        </Button>
      </Actions>
    </>
  )
}
