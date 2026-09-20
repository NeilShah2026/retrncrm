import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { forgetStoredSession, supabase } from '@/lib/supabase'
import { clearBriefingCache } from '@/lib/ai/briefing'
import { clearSkippedMeetingNotes } from '@/lib/inbox'
import { resetAnalytics, track } from '@/lib/analytics'
import { clearSubscriptionCache } from '@/lib/billing/store'
import { ensureUserSeeded } from '@/lib/seedNewUser'
import { applyPendingScan } from '@/lib/pendingScan'
import { syncAccountEmail } from '@/lib/eduVerification'
import { profileToMetadata, type ShareProfile } from '@/lib/shareProfile'
import type { OnboardingPrefs } from '@/lib/onboarding'
import { isNative } from '@/lib/platform'
import {
  NATIVE_AUTH_REDIRECT_URL,
  listenForNativeAuthRedirect,
  openNativeAuthUrl,
} from '@/lib/nativeAuth'
import { clearReminders } from '@/lib/reminderNotifications'

interface AuthResult {
  error: string | null
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  /** True until the initial session check completes. */
  loading: boolean
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithMagicLink: (email: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signInWithApple: () => Promise<AuthResult>
  signOut: () => Promise<void>
  updateName: (name: string) => Promise<AuthResult>
  updateCollege: (college: string) => Promise<AuthResult>
  updateProfile: (profile: ShareProfile) => Promise<AuthResult>
  /** Writes the onboarding answers (and the completion flag) onto the account. */
  saveOnboarding: (prefs: OnboardingPrefs) => Promise<AuthResult>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

/**
 * Everything that should happen once we know who is signed in. Both the
 * initial session check and every later auth change funnel through here.
 * `syncAccountEmail` is a no-op unless the account email is a school address
 * that hasn't been recorded yet, so it costs nothing for everyone else.
 *
 * `applyPendingScan` is what finishes a sign-up that started on a scanned QR
 * card: the person met is written into the network here, once there is a
 * session to write it with. It too is a no-op for everyone else.
 */
function onSignedIn(user: User): void {
  void ensureUserSeeded(user)
  void syncAccountEmail(user)
  void applyPendingScan()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) void onSignedIn(data.session.user)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) void onSignedIn(next.user)
    })

    // Native only: completes Google OAuth / magic-link / signup-confirmation
    // sign-in when iOS hands the app back its custom-scheme redirect URL.
    const removeNativeAuthListener = isNative ? listenForNativeAuthRedirect() : undefined

    return () => {
      active = false
      listener.subscription.unsubscribe()
      removeNativeAuthListener?.()
    }
  }, [])

  const signUpWithPassword = React.useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        // Native only — web keeps Supabase's default Site URL. Without this,
        // confirming on a phone still works (it lands on the web app) but
        // leaves the user to reopen and sign into the native app by hand.
        ...(isNative && { options: { emailRedirectTo: NATIVE_AUTH_REDIRECT_URL } }),
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signInWithPassword = React.useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signInWithMagicLink = React.useCallback(
    async (email: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: isNative
            ? NATIVE_AUTH_REDIRECT_URL
            : `${window.location.origin}/app`,
        },
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signInWithProvider = React.useCallback(
    async (provider: 'google' | 'apple'): Promise<AuthResult> => {
      if (isNative) {
        // The WebView can't complete a provider's consent screen (Google
        // blocks embedded WebViews outright) — open it in the system browser
        // instead and let `NATIVE_AUTH_REDIRECT_URL` hand control back to us.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: NATIVE_AUTH_REDIRECT_URL, skipBrowserRedirect: true },
        })
        if (error) return { error: error.message }
        if (data.url) await openNativeAuthUrl(data.url)
        return { error: null }
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/app` },
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signInWithGoogle = React.useCallback(
    () => signInWithProvider('google'),
    [signInWithProvider],
  )

  const signInWithApple = React.useCallback(
    () => signInWithProvider('apple'),
    [signInWithProvider],
  )

  const signOut = React.useCallback(async () => {
    // The cached App Store entitlement is per-device, not per-account, so it
    // has to go with the session — otherwise the next person to sign in on a
    // shared phone inherits the last one's plan until the store is asked
    // again. The receipt itself is untouched: restoring brings it straight
    // back for the Apple ID that actually paid.
    await clearSubscriptionCache()
    // Reminders are scheduled on the phone itself, so they'd otherwise keep
    // firing for this account after someone else signs in.
    await clearReminders()

    // Caches that belong to the account rather than the device, so the next
    // person to sign in on a shared phone starts clean.
    clearBriefingCache()
    clearSkippedMeetingNotes()
    track('signed_out')
    // Stop attributing whatever happens next to the account that just left.
    resetAnalytics()

    // 'local' on purpose: signing out of this phone shouldn't end the
    // session on the laptop. Whatever the server says — including nothing at
    // all, offline — the session goes from this device.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      console.warn('[auth] sign-out call failed; clearing locally', error.message)
      await forgetStoredSession()
    }
    // supabase-js only emits SIGNED_OUT when its own call succeeded, so the
    // screen is sent back to sign-in from here rather than from the listener.
    setSession(null)
  }, [])

  const updateName = React.useCallback(async (name: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
    return { error: error?.message ?? null }
  }, [])

  const updateCollege = React.useCallback(async (college: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ data: { college } })
    return { error: error?.message ?? null }
  }, [])

  const updateProfile = React.useCallback(
    async (profile: ShareProfile): Promise<AuthResult> => {
      const { error } = await supabase.auth.updateUser({
        data: profileToMetadata(profile),
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  /**
   * The onboarding answers live in `user_metadata` rather than a table of
   * their own: they are preferences about how the app should behave for this
   * person, they are small, and putting them on the account means they follow
   * the user to a new device without a fetch. `updateUser` merges top-level
   * keys, so this never clobbers the name, college or share profile.
   */
  const saveOnboarding = React.useCallback(
    async (prefs: OnboardingPrefs): Promise<AuthResult> => {
      const { error } = await supabase.auth.updateUser({ data: { ...prefs } })
      return { error: error?.message ?? null }
    },
    [],
  )

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signUpWithPassword,
      signInWithPassword,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithApple,
      signOut,
      updateName,
      updateCollege,
      updateProfile,
      saveOnboarding,
    }),
    [
      session,
      loading,
      signUpWithPassword,
      signInWithPassword,
      signInWithMagicLink,
      signInWithGoogle,
      signInWithApple,
      signOut,
      updateName,
      updateCollege,
      updateProfile,
      saveOnboarding,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
