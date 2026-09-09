import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ensureUserSeeded } from '@/lib/seedNewUser'
import { syncAccountEmail } from '@/lib/eduVerification'
import { profileToMetadata, type ShareProfile } from '@/lib/shareProfile'
import type { DashboardLayout } from '@/lib/dashboardLayout'

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
  signOut: () => Promise<void>
  updateName: (name: string) => Promise<AuthResult>
  updateCollege: (college: string) => Promise<AuthResult>
  updateProfile: (profile: ShareProfile) => Promise<AuthResult>
  /** Persists the home screen's widget layout on the account, not the device. */
  updateDashboardLayout: (layout: DashboardLayout) => Promise<AuthResult>
  markOnboarded: () => Promise<AuthResult>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

/**
 * Everything that should happen once we know who is signed in. Both the
 * initial session check and every later auth change funnel through here.
 * `syncAccountEmail` is a no-op unless the account email is a school address
 * that hasn't been recorded yet, so it costs nothing for everyone else.
 */
function onSignedIn(user: User): void {
  void ensureUserSeeded(user)
  void syncAccountEmail(user)
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

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signUpWithPassword = React.useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signUp({ email, password })
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
        options: { emailRedirectTo: `${window.location.origin}/app` },
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signInWithGoogle = React.useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
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

  const updateDashboardLayout = React.useCallback(
    async (layout: DashboardLayout): Promise<AuthResult> => {
      const { error } = await supabase.auth.updateUser({
        data: { dashboard_layout: layout },
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  const markOnboarded = React.useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ data: { onboarded: true } })
    return { error: error?.message ?? null }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signUpWithPassword,
      signInWithPassword,
      signInWithMagicLink,
      signInWithGoogle,
      signOut,
      updateName,
      updateCollege,
      updateProfile,
      updateDashboardLayout,
      markOnboarded,
    }),
    [
      session,
      loading,
      signUpWithPassword,
      signInWithPassword,
      signInWithMagicLink,
      signInWithGoogle,
      signOut,
      updateName,
      updateCollege,
      updateProfile,
      updateDashboardLayout,
      markOnboarded,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
