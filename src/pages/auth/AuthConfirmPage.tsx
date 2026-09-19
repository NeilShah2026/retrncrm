import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { CircleAlert, Loader2, Mail, Smartphone } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { NATIVE_AUTH_REDIRECT_URL } from '@/lib/nativeAuth'
import { ROUTES } from '@/lib/routes'
import { supabase } from '@/lib/supabase'

/** Hosts a link may carry someone on to. Anything else lands on /app here. */
const KNOWN_HOSTS = [
  'retrncrm.com',
  'www.retrncrm.com',
  'retrnapp.com',
  'www.retrnapp.com',
  'localhost',
  '127.0.0.1',
]

type Plan =
  /** Sign in here, then go to `path`. */
  | { kind: 'web'; path: string }
  /** Hand the unspent link to the iPhone app, which signs itself in. */
  | { kind: 'native'; url: string }

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; plan: Plan; busy: boolean }
  | { kind: 'error'; message: string }

/**
 * Where sign-in and sign-up confirmation emails link to (via the Supabase
 * email templates), instead of Supabase's own verify URL.
 *
 * Supabase's link signs in the moment it's opened, and it only works once.
 * School and work mail (Babson is on Microsoft 365) opens every link to scan
 * it before the person sees the email, which spends it — so their own click
 * then says "invalid or expired". This page spends nothing on load: the link
 * is only used when a person taps the button.
 */
export function AuthConfirmPage() {
  const navigate = useNavigate()
  const [state, setState] = React.useState<State>({ kind: 'loading' })
  const params = React.useRef<{ tokenHash: string; type: EmailOtpType } | null>(null)

  React.useEffect(() => {
    if (params.current) return
    const url = new URL(window.location.href)
    const tokenHash = url.searchParams.get('token_hash')
    const type = (url.searchParams.get('type') as EmailOtpType | null) ?? 'email'
    const next = url.searchParams.get('next')

    if (!tokenHash) {
      setState({
        kind: 'error',
        message: 'This link is incomplete. Open it straight from the email, or ask for a new one.',
      })
      return
    }
    params.current = { tokenHash, type }

    const target = resolveNext(next)
    if (target.kind === 'elsewhere') {
      // Asked for from local development: pass the link on unspent, so the
      // session lands there.
      window.location.replace(`${target.origin}${ROUTES.authConfirm}${url.search}`)
      return
    }

    window.history.replaceState(null, '', url.pathname)
    setState({
      kind: 'ready',
      busy: false,
      plan:
        target.kind === 'native'
          ? {
              kind: 'native',
              url: `${NATIVE_AUTH_REDIRECT_URL}?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`,
            }
          : { kind: 'web', path: target.path },
    })
  }, [])

  async function go() {
    if (state.kind !== 'ready' || !params.current) return
    const { plan } = state
    if (plan.kind === 'native') {
      window.location.href = plan.url
      return
    }
    setState({ ...state, busy: true })
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.current.tokenHash,
      type: params.current.type,
    })
    if (error) {
      setState({ kind: 'error', message: explain(error.message) })
      return
    }
    navigate(plan.path, { replace: true })
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
              {state.plan.kind === 'native' ? (
                <Smartphone className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Mail className="h-6 w-6 text-muted-foreground" />
              )}
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                {state.plan.kind === 'native' ? 'Open Retrn' : 'Sign in to Retrn'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {state.plan.kind === 'native'
                  ? 'Tap below to finish signing in in the Retrn app.'
                  : 'Tap below to finish signing in.'}
              </p>
              <Button className="mt-6 w-full" disabled={state.busy} onClick={() => void go()}>
                {state.busy && <Loader2 className="animate-spin" />}
                {state.plan.kind === 'native' ? 'Open in the Retrn app' : 'Continue'}
              </Button>
            </>
          )}

          {state.kind === 'error' && (
            <>
              <CircleAlert className="h-6 w-6 text-danger" />
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                That link didn’t work
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{state.message}</p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => navigate(ROUTES.login)}>
                Back to sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Where `next` (the redirect the link was asked for with) should send someone. */
function resolveNext(
  next: string | null,
): { kind: 'web'; path: string } | { kind: 'native' } | { kind: 'elsewhere'; origin: string } {
  if (!next) return { kind: 'web', path: ROUTES.app }
  if (next.startsWith(NATIVE_AUTH_REDIRECT_URL)) return { kind: 'native' }
  if (next.startsWith('/') && !next.startsWith('//')) return { kind: 'web', path: next }
  try {
    const url = new URL(next)
    if (!KNOWN_HOSTS.includes(url.hostname)) return { kind: 'web', path: ROUTES.app }
    // Only local development is passed on. The production hosts redirect to
    // each other (apex → www), so forwarding between them could loop; signing
    // in on whichever one this is works just as well.
    const local = ['localhost', '127.0.0.1']
    if (local.includes(url.hostname) && url.origin !== window.location.origin) {
      return { kind: 'elsewhere', origin: url.origin }
    }
    // The Site URL (what a password sign-up confirms back to) is the homepage;
    // having just signed in, the app is where they mean to go.
    if (url.pathname === ROUTES.home) return { kind: 'web', path: ROUTES.app }
    return { kind: 'web', path: `${url.pathname}${url.search}` }
  } catch {
    return { kind: 'web', path: ROUTES.app }
  }
}

function explain(message: string): string {
  if (/invalid or has expired|otp_expired/i.test(message)) {
    return 'This link has expired or was already used. Links work once and last an hour — ask for a new one.'
  }
  return message
}
