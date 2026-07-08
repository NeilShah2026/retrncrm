import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Mail, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'
type Method = 'password' | 'magic-link'

export function LoginPage() {
  const {
    user,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signInWithGoogle,
  } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = React.useState<Mode>('signin')
  const [method, setMethod] = React.useState<Method>('password')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [googleSubmitting, setGoogleSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = React.useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = React.useState(false)

  // Already signed in — no reason to see the login screen.
  if (!loading && user) return <Navigate to={ROUTES.dashboard} replace />

  async function handleGoogle() {
    setError(null)
    setGoogleSubmitting(true)
    const { error } = await signInWithGoogle()
    // On success the browser navigates away to Google immediately, so we
    // only ever get here to handle a failure (e.g. provider not enabled).
    if (error) {
      setError(error)
      setGoogleSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (method === 'magic-link') {
        const { error } = await signInWithMagicLink(email)
        if (error) setError(error)
        else setMagicLinkSent(true)
        return
      }
      if (mode === 'signup') {
        const { error } = await signUpWithPassword(email, password)
        if (error) {
          setError(error)
        } else {
          // If email confirmation is off, this sign-up already produced a
          // session and the redirect below will fire on next render via the
          // `user` check above. If confirmation is required, show the notice.
          setConfirmEmailSent(true)
        }
      } else {
        const { error } = await signInWithPassword(email, password)
        if (error) setError(error)
        else navigate(ROUTES.dashboard)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080c] px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/25 blur-[130px]"
      />

      <div className="relative w-full max-w-sm">
        <Link to={ROUTES.home} className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Users className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Retrn</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
          {magicLinkSent ? (
            <EmailNotice
              icon={Mail}
              title="Check your email"
              body={`We sent a sign-in link to ${email}. Open it on this device to continue.`}
              onBack={() => setMagicLinkSent(false)}
            />
          ) : confirmEmailSent ? (
            <EmailNotice
              icon={ShieldCheck}
              title="Almost there"
              body={`We sent a confirmation link to ${email}. Confirm your address to finish creating your account.`}
              onBack={() => {
                setConfirmEmailSent(false)
                setMode('signin')
              }}
            />
          ) : (
            <>
              <h1 className="font-serif text-2xl font-medium text-white">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="mt-1.5 text-sm text-white/50">
                {mode === 'signin'
                  ? 'Sign in to get back to your network.'
                  : 'Free, forever — takes about ten seconds.'}
              </p>

              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={googleSubmitting}
                className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.07] disabled:opacity-60"
              >
                <GoogleIcon className="h-4 w-4" />
                {googleSubmitting ? 'Please wait…' : 'Continue with Google'}
              </button>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-wide text-white/30">
                  or
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-white/70">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/25"
                  />
                </div>

                {method === 'password' && (
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-xs font-medium text-white/70">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/25"
                    />
                  </div>
                )}

                {error && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {submitting
                    ? 'Please wait…'
                    : method === 'magic-link'
                      ? 'Send magic link'
                      : mode === 'signin'
                        ? 'Sign in'
                        : 'Create account'}
                  {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setMethod((m) => (m === 'password' ? 'magic-link' : 'password'))
                  setError(null)
                }}
                className="mt-4 w-full text-center text-xs text-white/45 transition-colors hover:text-white/70"
              >
                {method === 'password'
                  ? 'Use a magic link instead'
                  : 'Use a password instead'}
              </button>

              <div className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-white/45">
                {mode === 'signin' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup')
                        setError(null)
                      }}
                      className="font-medium text-white/80 hover:text-white"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin')
                        setError(null)
                      }}
                      className="font-medium text-white/80 hover:text-white"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function EmailNotice({
  icon: Icon,
  title,
  body,
  onBack,
}: {
  icon: typeof Mail
  title: string
  body: string
  onBack: () => void
}) {
  return (
    <div className={cn('flex flex-col items-center py-2 text-center')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-serif text-xl font-medium text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-xs font-medium text-white/60 hover:text-white"
      >
        ← Back
      </button>
    </div>
  )
}
