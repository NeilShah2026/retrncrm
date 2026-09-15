import { useEffect, useRef, useState } from 'preact/hooks'
import { sendCode, signInWithPassword, suggestEmail, verifyCode } from '../auth'
import { APP_ORIGIN } from '../config'
import { ErrorNotice, Frame } from './common'
import { openUrl, type Host } from './host'

type Step = { kind: 'email' } | { kind: 'code'; email: string } | { kind: 'password' }

const RESEND_AFTER_S = 60

/**
 * Signing in with a code emailed to the account address, or a password for
 * accounts that have one. The extension gets a session of its own, so this
 * never signs anyone out of the website.
 */
export function SignIn({ host, retired }: { host: Host; retired: boolean }) {
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [suggested, setSuggested] = useState(false)

  useEffect(() => {
    void suggestEmail().then((found) => {
      if (!found) return
      setEmail((current) => current || found)
      setSuggested(true)
    })
  }, [])

  if (step.kind === 'code') {
    return (
      <CodeStep
        host={host}
        email={step.email}
        onBack={() => setStep({ kind: 'email' })}
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
            onUseCode={() => setStep({ kind: 'email' })}
          />
        ) : (
          <EmailForm
            email={email}
            setEmail={setEmail}
            suggested={suggested}
            onSent={(address) => setStep({ kind: 'code', email: address })}
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
      await sendCode(address)
      onSent(address)
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
        {busy ? 'Sending code…' : 'Email me a sign-in code'}
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
  onUseCode,
}: {
  email: string
  setEmail: (v: string) => void
  onUseCode: () => void
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
      <button type="button" class="btn btn-ghost btn-block mt-8" onClick={onUseCode}>
        Email me a code instead
      </button>
    </form>
  )
}

function CodeStep({ host, email, onBack }: { host: Host; email: string; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(RESEND_AFTER_S)
  const [resent, setResent] = useState(false)
  const submitted = useRef('')

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function verify(value: string) {
    if (busy || submitted.current === value) return
    submitted.current = value
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, value)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function resend() {
    setError(null)
    setResent(false)
    try {
      await sendCode(email)
      setWait(RESEND_AFTER_S)
      setResent(true)
      submitted.current = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Frame host={host}>
      <h1 class="title">Check your email</h1>
      <p class="lede">
        Enter the code we sent to <strong>{email}</strong>.
      </p>
      <form
        class="mt-16"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length >= 6) void verify(code)
        }}
      >
        <div class="field">
          <label class="label" for="code">
            Sign-in code
          </label>
          <input
            id="code"
            class="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
            value={code}
            aria-invalid={Boolean(error)}
            autoFocus
            onInput={(e) => {
              const digits = e.currentTarget.value.replace(/\D/g, '').slice(0, 8)
              setCode(digits)
              if (error) setError(null)
              // Codes are six digits unless the project was set up for more;
              // checking at six covers the usual case without a button press.
              if (digits.length === 6) void verify(digits)
            }}
          />
        </div>
        {error && <div class="field"><ErrorNotice>{error}</ErrorNotice></div>}
        {resent && !error && <p class="small muted field">Sent a new code.</p>}
        <button class="btn btn-primary btn-block" type="submit" disabled={busy || code.length < 6} aria-busy={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      <div class="hstack mt-12 small">
        <button class="link" type="button" onClick={onBack}>
          Use a different email
        </button>
        <span class="spacer" />
        {wait > 0 ? (
          <span class="muted tnum">Resend in {wait}s</span>
        ) : (
          <button class="link" type="button" onClick={() => void resend()}>
            Send a new code
          </button>
        )}
      </div>
      <p class="small muted mt-16">
        Can’t find it? Check spam for an email from Retrn. Codes expire after an hour.
      </p>
    </Frame>
  )
}
