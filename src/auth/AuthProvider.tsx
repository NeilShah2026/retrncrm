import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ensureUserSeeded } from '@/lib/seedNewUser'

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
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) void ensureUserSeeded(data.session.user)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) void ensureUserSeeded(next.user)
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
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
