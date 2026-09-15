import { useEffect, useState } from 'preact/hooks'
import { clearPendingSignIn, getPendingSignIn, sendMagicLink, signInWithPassword, suggestEmail } from '../auth'
import { APP_ORIGIN } from '../config'
import { ErrorNotice, Frame } from './common'
import { openUrl, type Host } from './host'

type Step =
  | { kind: 'loading' }
  | { kind: 'email' }
  | { kind: 'sent'; email: string; sentAt: number }
  | { kind: 'password' }

const RESEND_AFTER_S = 60

/**
 * Signing in with a magic link emailed to the account address, or a password
 * for accounts that have one. The extension gets a session of its own, so this
 * never signs anyone out of the website.
 */
export function SignIn({ host, retired }: { host: Host; retired: boolean }) {
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [email, setEmail] = useState('')
  const [suggested, setSuggested] = useState(false)

  useEffect(() => {
    // The popup closes as soon as someone switches to their inbox, so a link
    // sent earlier is remembered and the next open picks up where they left off.
    void getPendingSignIn().then((pending) => {
      setStep((current) => {
        if (current.kind !== 'loading') return current
        return pending ? { kind: 'sent', email: pending.email, sentAt: pending.sentAt } : { kind: 'email' }
      })
    })
    void suggestEmail().then((found) => {
      if (!found) return
      setEmail((current) => current || found)
      setSuggested(true)
    })
  }, [])

  if (step.kind === 'loading') return <Frame host={host}>{null}</Frame>

  if (step.kind === 'sent') {
    return (
      <LinkSent
        host={host}
        email={step.email}
        sentAt={step.sentAt}
        onResent={(sentAt) => setStep({ ...step, sentAt })}
        onBack={() => {
          void clearPendingSignIn()
          setEmail(step.email)
          setStep({ kind: 'email' })
        }}
      />
    )
  }

  return (
    <Frame host={host}>
      <h1 class="title">Sign in to Retrn</h1>
      <p class="lede">
        Log emails and people to your network from Gmail, Outlook and LinkedIn.
      </p>
      {retired && (
        <div class="notice mt-12">
          <div>
            The extension now signs in separately from the website, so it can never sign you out
            there. You’ll only need to do this once.
          </div>
        </div>
      )}
      <div class="mt-16">
        {step.kind === 'password' ? (
          <PasswordForm
            email={email}
            setEmail={setEmail}
            onUseLink={() => setStep({ kind: 'email' })}
          />
        ) : (
          <EmailForm
            email={email}
            setEmail={setEmail}
            suggested={suggested}
            onSent={(address) => setStep({ kind: 'sent', email: address, sentAt: Date.now() })}
            onUsePassword={() => setStep({ kind: 'password' })}
          />
        )}
      </div>
      <p class="small muted mt-16">
        New to Retrn?{' '}
        <a
          class="link"
          href={`${APP_ORIGIN}/login`}
          onClick={(e) => {
            e.preventDefault()
            openUrl(`${APP_ORIGIN}/login`, host)
          }}
        >
          Create an account
        </a>
      </p>
    </Frame>
  )
}

function EmailForm({
  email,
  setEmail,
  suggested,
  onSent,
  onUsePassword,
}: {
  email: string
  setEmail: (v: string) => void
  suggested: boolean
  onSent: (email: string) => void
  onUsePassword: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: Event) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setError(null)
    try {
      await sendMagicLink(address)
      onSent(address.toLowerCase())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div class="field">
        <label class="label" for="email">
          Email
        </label>
        <input
          id="email"
          class="input"
          type="email"
          autoComplete="email"
          placeholder="you@school.edu"
          value={email}
          onInput={(e) => setEmail(e.currentTarget.value)}
          autoFocus
          required
        />
        {suggested && <p class="small muted mt-8">From your open Retrn tab.</p>}
      </div>
      {error && <div class="field"><ErrorNotice>{error}</ErrorNotice></div>}
      <button class="btn btn-primary btn-block" type="submit" disabled={busy || !email.trim()} aria-busy={busy}>
        {busy ? 'Sending link…' : 'Email me a sign-in link'}
      </button>
      <button type="button" class="btn btn-ghost btn-block mt-8" onClick={onUsePassword}>
        Use a password instead
      </button>
    </form>
  )
}

function PasswordForm({
  email,
  setEmail,
  onUseLink,
}: {
  email: string
  setEmail: (v: string) => void
  onUseLink: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithPassword(email, password)
      // The session change re-renders the app from the top.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div class="field">
        <label class="label" for="email">
          Email
        </label>
        <input
          id="email"
          class="input"
          type="email"
          autoComplete="email"
          value={email}
          onInput={(e) => setEmail(e.currentTarget.value)}
          autoFocus={!email}
          required
        />
      </div>
      <div class="field">
        <label class="label" for="password">
          Password
        </label>
        <input
          id="password"
          class="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onInput={(e) => setPassword(e.currentTarget.value)}
          autoFocus={Boolean(email)}
          required
        />
      </div>
      {error && <div class="field"><ErrorNotice>{error}</ErrorNotice></div>}
      <button
        class="btn btn-primary btn-block"
        type="submit"
        disabled={busy || !email.trim() || !password}
        aria-busy={busy}
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <button type="button" class="btn btn-ghost btn-block mt-8" onClick={onUseLink}>
        Email me a sign-in link instead
      </button>
    </form>
  )
}

function LinkSent({
  host,
  email,
  sentAt,
  onResent,
  onBack,
}: {
  host: Host
  email: string
  sentAt: number
  onResent: (sentAt: number) => void
  onBack: () => void
}) {
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)
  const wait = Math.max(0, RESEND_AFTER_S - Math.floor((now - sentAt) / 1000))

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(t)
  }, [wait, now])

  async function resend() {
    setError(null)
    setResent(false)
    setBusy(true)
    try {
      await sendMagicLink(email)
      const at = Date.now()
      setNow(at)
      onResent(at)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame host={host}>
      <h1 class="title">Check your email</h1>
      <p class="lede">
        We sent a sign-in link to <strong>{email}</strong>. Open it in this browser and the
        extension signs in on its own.
      </p>
      {error && <div class="mt-12"><ErrorNotice>{error}</ErrorNotice></div>}
      {resent && !error && <p class="small muted mt-12">Sent a new link. Use the newest email.</p>}
      <div class="hstack mt-16 small">
        <button class="link" type="button" onClick={onBack}>
          Use a different email
        </button>
        <span class="spacer" />
        {wait > 0 ? (
          <span class="muted tnum">Resend in {wait}s</span>
        ) : (
          <button class="link" type="button" disabled={busy} onClick={() => void resend()}>
            {busy ? 'Sending…' : 'Send a new link'}
          </button>
        )}
      </div>
      <p class="small muted mt-16">
        Can’t find it? Check your spam folder. Links expire after an hour.
      </p>
    </Frame>
  )
}
