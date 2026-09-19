import * as React from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CircleAlert, GraduationCap, Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthProvider'
import {
  claimLink,
  previewLink,
  proofFromLanding,
  readLandingUrl,
  type LandingLink,
} from '@/lib/eduVerification'
import { ROUTES } from '@/lib/routes'

type State =
  | { kind: 'loading' }
  /** A link that hasn't been spent yet: waits for a person to press Continue. */
  | { kind: 'ready'; link: LandingLink; opening: boolean }
  | { kind: 'confirm'; proof: string; email: string; account: string | null }
  | { kind: 'claiming'; proof: string; email: string; account: string | null }
  | { kind: 'done'; email: string }
  | { kind: 'error'; message: string }

/**
 * Where the Babson verification email's magic link lands.
 *
 * Public, and deliberately independent of the Retrn session: the link is often
 * opened on the phone the school inbox lives on, not the laptop that asked for
 * it. The server matches the proven address back to the account that asked,
 * and this page shows which account that is before committing — so a link
 * nobody here asked for can't quietly hand the address to someone else.
 */
export function VerifyEduPage() {
  const { user } = useAuth()
  const [state, setState] = React.useState<State>({ kind: 'loading' })
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    const url = new URL(window.location.href)
    // The fragment holds a live session for the school address — don't leave
    // it sitting in the address bar or the history.
    window.history.replaceState(null, '', url.pathname)
    try {
      const link = readLandingUrl(url)
      // Never spend a link on page load: mail scanners open links too, and
      // only a person presses the button.
      if (link.kind === 'hash') setState({ kind: 'ready', link, opening: false })
      else void open(link)
    } catch (err) {
      setState({ kind: 'error', message: explain(err) })
    }
  }, [])

  async function open(link: LandingLink) {
    try {
      const proof = await proofFromLanding(link)
      const { email, account } = await previewLink(proof)
      setState({ kind: 'confirm', proof, email, account })
    } catch (err) {
      setState({ kind: 'error', message: explain(err) })
    }
  }

  async function confirm() {
    if (state.kind !== 'confirm') return
    setState({ ...state, kind: 'claiming' })
    try {
      const email = await claimLink(state.proof)
      setState({ kind: 'done', email: email || state.email })
    } catch (err) {
      setState({
        kind: 'error',
        message: explain(err),
      })
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        <Logo />

        <div className="mt-16">
          {state.kind === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your link…
            </p>
          )}

          {state.kind === 'ready' && (
            <>
              <GraduationCap className="h-6 w-6 text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                Verify your Babson email
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                Continue to confirm this address and unlock Retrn for free.
              </p>
              <Button
                className="mt-6 w-full"
                disabled={state.opening}
                onClick={() => {
                  setState({ ...state, opening: true })
                  void open(state.link)
                }}
              >
                {state.opening && <Loader2 className="animate-spin" />}
                Continue
              </Button>
            </>
          )}

          {(state.kind === 'confirm' || state.kind === 'claiming') && (
            <>
              <GraduationCap className="h-6 w-6 text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                Verify your Babson email
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                <span className="break-all text-foreground">{state.email}</span> will unlock
                every paid feature, free, on the Retrn account
                {state.account ? (
                  <>
                    {' '}
                    <span className="text-foreground">{state.account}</span>
                  </>
                ) : (
                  ' that asked for this link'
                )}
                .
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Didn’t ask for this? Just close the page — nothing changes.
              </p>
              <Button
                className="mt-6 w-full"
                disabled={state.kind === 'claiming'}
                onClick={() => void confirm()}
              >
                {state.kind === 'claiming' && <Loader2 className="animate-spin" />}
                Verify
              </Button>
            </>
          )}

          {state.kind === 'done' && (
            <>
              <BadgeCheck className="h-6 w-6 text-success" />
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">You’re verified</h1>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                <span className="break-all text-foreground">{state.email}</span> is confirmed.
                Retrn is free for you — head back to the app or the tab you started in and it
                will update on its own.
              </p>
              {user && (
                <Button asChild className="mt-6 w-full">
                  <Link to={ROUTES.dashboard}>Open Retrn</Link>
                </Button>
              )}
            </>
          )}

          {state.kind === 'error' && (
            <>
              <CircleAlert className="h-6 w-6 text-danger" />
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                That link didn’t work
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{state.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Links expire after an hour and work once. Send a fresh one from Settings.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Supabase's own wording for a spent link blames the user; it was almost
 * certainly the school's mail scanner opening it first.
 */
function explain(err: unknown): string {
  const message = err instanceof Error ? err.message : 'That link didn’t work.'
  if (/invalid or has expired|otp_expired/i.test(message)) {
    return 'This link was already used — school email often opens links automatically to scan them, which uses them up. Send a new one from Settings.'
  }
  return message
}
