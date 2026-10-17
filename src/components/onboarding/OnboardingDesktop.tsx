import * as React from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnboardingFlow } from '@/components/onboarding/shared'

/**
 * The laptop's welcome screen: a held card asking for a name. Pressing Enter
 * saves it and drops straight into the app, where the tooltip tour takes over.
 */
export function OnboardingDesktop() {
  const { name, setName, mustName, ready, saving, submit, skip } = useOnboardingFlow()

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !mustName) skip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mustName, skip])

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-sunken">
      <header className="flex shrink-0 items-center justify-between gap-6 px-6 py-4">
        <Logo />
        {/* Only Sign in with Apple accounts may skip the name (nameRequired). */}
        {!mustName && (
          <Button variant="ghost" size="sm" onClick={skip}>
            Skip
            <Kbd>Esc</Kbd>
          </Button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="turn-in w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-sm">
          <NamePane
            name={name}
            onChange={setName}
            ready={ready}
            saving={saving}
            onSubmit={() => void submit()}
          />
        </div>
      </main>
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
