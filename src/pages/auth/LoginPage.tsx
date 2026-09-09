import * as React from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { GraduationCap, Mail, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/auth/AuthProvider'
import { ROUTES } from '@/lib/routes'

type Mode = 'signin' | 'signup'
type Method = 'password' | 'magic-link'

/** Sign in. The same tokens as the app; nothing on the page but the form. */
export function LoginPage() {
  const { user, loading, signInWithPassword, signUpWithPassword, signInWithMagicLink, signInWithGoogle } =
    useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // Only same-origin app paths, to avoid an open redirect.
  const rawNext = params.get('next')
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : ROUTES.dashboard

  const plan = params.get('plan')
  const fromPaidPlan = plan === 'student' || plan === 'standard'

  const [mode, setMode] = React.useState<Mode>(fromPaidPlan ? 'signup' : 'signin')
  const [method, setMethod] = React.useState<Method>('password')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [googleSubmitting, setGoogleSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = React.useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = React.useState(false)

  if (!loading && user) return <Navigate to={next} replace />

  async function handleGoogle() {
    setError(null)
    setGoogleSubmitting(true)
    const { error } = await signInWithGoogle()
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
        if (error) setError(error)
        else setConfirmEmailSent(true)
      } else {
        const { error } = await signInWithPassword(email, password)
        if (error) setError(error)
        else navigate(next)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link to={ROUTES.home} className="inline-block rounded-sm">
          <Logo />
        </Link>

        {fromPaidPlan && (
          <p className="mt-8 flex items-start gap-2 rounded-lg border bg-bg-sunken/60 px-3 py-2.5 text-sm text-text-secondary">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium text-foreground">Babson student?</span> Sign up with your
              @babson.edu email, or verify it later in Settings, and everything in{' '}
              {plan === 'student' ? 'Student' : 'Standard'} is free.
            </span>
          </p>
        )}

        <div className="mt-8">
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
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                {mode === 'signin' ? 'Sign in to Retrn' : 'Create your account'}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === 'signin' ? 'Back to your network.' : 'Free for up to 30 contacts. Takes about ten seconds.'}
              </p>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void handleGoogle()}
                loading={googleSubmitting}
                className="mt-6 w-full"
              >
                {!googleSubmitting && <GoogleIcon className="h-4 w-4" />}
                Continue with Google
              </Button>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="h-9"
                  />
                </div>

                {method === 'password' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}

                {error && (
                  <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" loading={submitting} className="w-full">
                  {method === 'magic-link' ? 'Send magic link' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setMethod((m) => (m === 'password' ? 'magic-link' : 'password'))
                  setError(null)
                }}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {method === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
              </button>

              <p className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground">
                {mode === 'signin' ? (
                  <>
                    New here?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup')
                        setError(null)
                      }}
                      className="font-medium text-foreground hover:underline"
                    >
                      Create an account
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
                      className="font-medium text-foreground hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>

              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                By continuing you agree to Retrn’s{' '}
                <Link to={ROUTES.terms} className="hover:text-foreground hover:underline">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to={ROUTES.privacy} className="hover:text-foreground hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
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
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
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
    <div className="rounded-lg border p-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-bg-sunken text-text-secondary">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button variant="ghost" size="sm" onClick={onBack} className="mt-5 -ml-2">
        Back
      </Button>
    </div>
  )
}
