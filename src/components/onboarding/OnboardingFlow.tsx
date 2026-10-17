import * as React from 'react'
import { AppMark, CapsuleButton } from '@/components/ui/capsule'
import { useOnboardingFlow } from '@/components/onboarding/shared'
import { OnboardingDesktop } from '@/components/onboarding/OnboardingDesktop'
import { useIsMobile } from '@/hooks/useIsMobile'
import { selectionFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/**
 * Onboarding: one question — what should we call you? — and you're in.
 *
 * The first version walked through what Retrn does and a plan offer before
 * anyone had seen the app, and testers found it too much at once. Now the
 * welcome screen asks for a name and nothing else; the laptop then starts a
 * tooltip tour of the real pages (components/tour), and the plan offer waits
 * until someone reaches the free limit.
 */

export function OnboardingFlow() {
  const isMobile = useIsMobile()
  if (!isMobile) return <OnboardingDesktop />
  return <PhoneOnboarding />
}

function PhoneOnboarding() {
  const { name, setName, mustName, ready, saving, submit, skip } = useOnboardingFlow()

  return (
    // `h-[100dvh]`, not `min-h`: the pinned action has to stay on screen.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+8px)]">
        <div className="flex h-11 items-center justify-end">
          {/* Only Sign in with Apple accounts may skip the name (nameRequired). */}
          {!mustName && (
            <button
              type="button"
              onClick={() => {
                selectionFeedback()
                skip()
              }}
              className="press text-ios-subhead flex h-11 items-center px-1 text-muted-foreground"
            >
              Skip
            </button>
          )}
        </div>
      </div>
      <div className="pane-in flex min-h-0 flex-1 flex-col">
        <NamePane name={name} onChange={setName} ready={ready} saving={saving} onSubmit={() => void submit()} />
      </div>
    </div>
  )
}

/** The scrolling body plus the pinned action area. */
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

