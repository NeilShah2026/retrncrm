import * as React from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { GraduationCap, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/useIsMobile'
import { errorFeedback, tapFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'
type Method = 'password' | 'magic-link'

/**
 * Sign in or create an account. Phones (the iOS app, and a phone's browser)
 * get an iOS sign-in screen; wider windows get the website's own form, in the
 * same design system as the rest of the desktop app. The switch is the app's
 * usual 768px breakpoint, where the sidebar replaces the tab bar.
 */
export function LoginPage() {
  const form = useLoginForm()
  const isMobile = useIsMobile()

  if (form.redirectTo) return <Navigate to={form.redirectTo} replace />
  return isMobile ? <PhoneLogin form={form} /> : <DesktopLogin form={form} />
}

type LoginForm = ReturnType<typeof useLoginForm>

/** Everything both layouts share: the fields, the mode, and what submitting does. */
function useLoginForm() {
  const {
    user,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signInWithGoogle,
    signInWithApple,
  } = useAuth()
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
  const [pendingProvider, setPendingProvider] = React.useState<'google' | 'apple' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = React.useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = React.useState(false)

  function fail(message: string) {
    errorFeedback()
    setError(message)
  }

  async function handleProvider(provider: 'google' | 'apple') {
    setError(null)
    setPendingProvider(provider)
    const { error } = await (provider === 'apple' ? signInWithApple() : signInWithGoogle())
    if (error) {
      fail(error)
      setPendingProvider(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (method === 'magic-link') {
        const { error } = await signInWithMagicLink(email)
        if (error) fail(error)
        else setMagicLinkSent(true)
        return
      }
      if (mode === 'signup') {
        const { error } = await signUpWithPassword(email, password)
        if (error) fail(error)
        else setConfirmEmailSent(true)
      } else {
        const { error } = await signInWithPassword(email, password)
        if (error) fail(error)
        else navigate(next)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return {
    redirectTo: !loading && user ? next : null,
    plan,
    fromPaidPlan,
    mode,
    method,
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    pendingProvider,
    busy: submitting || pendingProvider !== null,
    error,
    magicLinkSent,
    confirmEmailSent,
    handleProvider,
    handleSubmit,
    toggleMode: () => {
      setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
      setError(null)
    },
    toggleMethod: () => {
      setMethod((m) => (m === 'password' ? 'magic-link' : 'password'))
      setError(null)
    },
    backFromMagicLink: () => setMagicLinkSent(false),
    backFromConfirmEmail: () => {
      setConfirmEmailSent(false)
      setMode('signin')
    },
  }
}

/**
 * An iOS sign-in screen: the app's mark, a title, the two account buttons
 * Apple expects to see first, then the form. Everything is a 50pt capsule on
 * a 17pt system face, and nothing takes focus on its own — an app that opens
 * straight into a keyboard reads as a web page that has taken over the
 * screen, which is exactly what this isn't.
 */
function PhoneLogin({ form }: { form: LoginForm }) {
  const {
    plan,
    fromPaidPlan,
    mode,
    method,
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    pendingProvider,
    busy,
    error,
    magicLinkSent,
    confirmEmailSent,
    handleProvider,
    handleSubmit,
  } = form

  return (
    // `keyboard-inset`: this page scrolls as a document, so the keyboard's
    // height is added below it to give a lower field somewhere to scroll up to.
    <div className="keyboard-inset flex min-h-[100dvh] flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        {magicLinkSent ? (
          <EmailNotice
            icon={Mail}
            title="Check your email"
            body={`We sent a sign-in link to ${email}. Open it on this device to continue.`}
            onBack={form.backFromMagicLink}
          />
        ) : confirmEmailSent ? (
          <EmailNotice
            icon={ShieldCheck}
            title="Almost there"
            body={`We sent a confirmation link to ${email}. Confirm your address to finish creating your account.`}
            onBack={form.backFromConfirmEmail}
          />
        ) : (
          <>
            <AppMark />

            <h1 className="text-ios-large-title mt-6 text-center">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-ios-subhead mt-2 text-center text-muted-foreground">
              {mode === 'signin'
                ? 'Your network, remembered.'
                : 'Free for up to 30 contacts. Takes about ten seconds.'}
            </p>

            {fromPaidPlan && (
              <p className="text-ios-footnote mt-5 flex items-start gap-2 rounded-[14px] bg-bg-sunken px-3.5 py-3 text-text-secondary">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-semibold text-foreground">Babson student?</span> Sign
                  up with your @babson.edu email, or verify it later in Settings, and
                  everything in {plan === 'student' ? 'Student' : 'Standard'} is free.
                </span>
              </p>
            )}

            <div className="mt-8 space-y-2.5">
              <CapsuleButton
                variant="apple"
                disabled={busy}
                loading={pendingProvider === 'apple'}
                onClick={() => void handleProvider('apple')}
              >
                <AppleIcon className="h-[18px] w-[18px]" />
                Continue with Apple
              </CapsuleButton>

              <CapsuleButton
                variant="outline"
                disabled={busy}
                loading={pendingProvider === 'google'}
                onClick={() => void handleProvider('google')}
              >
                <GoogleIcon className="h-[17px] w-[17px]" />
                Continue with Google
              </CapsuleButton>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-ios-footnote text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit}>
              {/* Inset grouped fields: one rounded container, hairline
                  between rows — the shape iOS uses for every form it owns. */}
              <div className="overflow-hidden rounded-[14px] bg-bg-sunken">
                <FormField
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={email}
                  onChange={setEmail}
                />
                {method === 'password' && (
                  <>
                    <div className="ml-4 h-px bg-border" />
                    <FormField
                      type="password"
                      placeholder="Password"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      minLength={6}
                      value={password}
                      onChange={setPassword}
                    />
                  </>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-ios-footnote mt-3 px-1 text-center text-danger"
                >
                  {error}
                </p>
              )}

              <CapsuleButton
                type="submit"
                variant="primary"
                className="mt-4"
                disabled={busy}
                loading={submitting}
              >
                {method === 'magic-link'
                  ? 'Send magic link'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
              </CapsuleButton>
            </form>

            <TextButton className="mt-5" onClick={form.toggleMethod}>
              {method === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
            </TextButton>

            <div className="flex-1" />

            <p className="text-ios-footnote mt-8 text-center text-muted-foreground">
              {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  form.toggleMode()
                }}
                className="press font-semibold text-brand"
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>

            <p className="text-ios-caption mt-4 text-center leading-relaxed text-muted-foreground">
              By continuing you agree to Retrn’s{' '}
              <Link to={ROUTES.terms} className="text-text-secondary underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link to={ROUTES.privacy} className="text-text-secondary underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * The website's sign-in: a centred column on the same tokens and controls as
 * the desktop app, with nothing on the page but the form.
 */
function DesktopLogin({ form }: { form: LoginForm }) {
  const {
    plan,
    fromPaidPlan,
    mode,
    method,
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    pendingProvider,
    busy,
    error,
    magicLinkSent,
    confirmEmailSent,
    handleProvider,
    handleSubmit,
  } = form

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-10">
      <div className="mx-auto my-auto w-full max-w-sm">
        <Link to={ROUTES.home} className="inline-block rounded-sm">
          <Logo />
        </Link>

        {fromPaidPlan && !magicLinkSent && !confirmEmailSent && (
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
            <DesktopEmailNotice
              icon={Mail}
              title="Check your email"
              body={`We sent a sign-in link to ${email}. Open it in this browser to continue.`}
              onBack={form.backFromMagicLink}
            />
          ) : confirmEmailSent ? (
            <DesktopEmailNotice
              icon={ShieldCheck}
              title="Almost there"
              body={`We sent a confirmation link to ${email}. Confirm your address to finish creating your account.`}
              onBack={form.backFromConfirmEmail}
            />
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                {mode === 'signin' ? 'Sign in to Retrn' : 'Create your account'}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === 'signin'
                  ? 'Your network, remembered.'
                  : 'Free for up to 30 contacts. Takes about ten seconds.'}
              </p>

              <div className="mt-6 space-y-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={busy}
                  loading={pendingProvider === 'google'}
                  onClick={() => void handleProvider('google')}
                >
                  {pendingProvider !== 'google' && <GoogleIcon className="h-4 w-4" />}
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={busy}
                  loading={pendingProvider === 'apple'}
                  onClick={() => void handleProvider('apple')}
                >
                  {pendingProvider !== 'apple' && <AppleIcon className="h-4 w-4" />}
                  Continue with Apple
                </Button>
              </div>

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
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  <p
                    role="alert"
                    className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
                  >
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={busy} loading={submitting}>
                  {method === 'magic-link'
                    ? 'Send magic link'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
                </Button>
              </form>

              <button
                type="button"
                onClick={form.toggleMethod}
                className="mt-4 w-full rounded-sm text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {method === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
              </button>

              <p className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground">
                {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
                <button
                  type="button"
                  onClick={form.toggleMode}
                  className="rounded-sm font-medium text-foreground hover:underline"
                >
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
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

function DesktopEmailNotice({
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
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mt-5">
        Back
      </Button>
    </div>
  )
}

/** The app's own icon, at the size iOS shows it during onboarding. */
function AppMark() {
  return (
    <div className="flex justify-center">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--glass-shadow)/0.18)]">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.02em]">R</span>
      </span>
    </div>
  )
}

/** A row in an inset grouped form: 50pt, no box of its own. */
function FormField({
  value,
  onChange,
  type,
  placeholder,
  autoComplete,
  minLength,
}: {
  value: string
  onChange: (value: string) => void
  type: string
  placeholder: string
  autoComplete: string
  minLength?: number
}) {
  return (
    <input
      type={type}
      required
      placeholder={placeholder}
      autoComplete={autoComplete}
      minLength={minLength}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-ios-body h-[50px] w-full bg-transparent px-4 text-foreground outline-none placeholder:text-muted-foreground"
    />
  )
}

const CAPSULE_VARIANT = {
  apple: 'bg-[#000] text-white dark:bg-white dark:text-black',
  outline: 'bg-bg-elevated text-foreground ring-1 ring-inset ring-border',
  primary: 'bg-brand text-brand-foreground',
} as const

/** A 50pt full-width capsule — the only button shape on this screen. */
function CapsuleButton({
  variant,
  loading,
  className,
  children,
  onClick,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: keyof typeof CAPSULE_VARIANT
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={(e) => {
        tapFeedback()
        onClick?.(e)
      }}
      className={cn(
        'press-scale text-ios-headline flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px]',
        'disabled:opacity-45',
        CAPSULE_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : children}
    </button>
  )
}

/** A plain tinted text action — iOS's quietest control. */
function TextButton({
  className,
  onClick,
  children,
}: {
  className?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onClick()
      }}
      className={cn('press text-ios-subhead w-full text-center text-brand', className)}
    >
      {children}
    </button>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.05 12.77c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.5zM14.88 5.2c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.69-.92 2.69.98.08 1.98-.5 2.58-1.23z" />
    </svg>
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
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-sunken text-text-secondary">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="text-ios-title mt-6">{title}</h2>
      <p className="text-ios-subhead mt-3 text-muted-foreground">{body}</p>
      <TextButton className="mt-8" onClick={onBack}>
        Back
      </TextButton>
      <div className="flex-1" />
    </div>
  )
}
