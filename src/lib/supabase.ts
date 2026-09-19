import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isNative } from './platform'
import { ROUTES } from './routes'
import { capacitorPreferencesStorage } from './nativeStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase ' +
      'project (Project Settings → API).',
  )
}

/**
 * Where the session is kept. Derived exactly as supabase-js derives it, so
 * `forgetStoredSession()` below clears the same key the client wrote.
 */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The native app completes auth via a custom-scheme redirect handled
    // by src/lib/nativeAuth.ts, not by Supabase reading `window.location` —
    // and there is no meaningful URL to detect a session in there anyway.
    //
    // Never on /verify-edu: the tokens there belong to a *school* address
    // being verified for this account, and picking them up would sign the
    // browser in as that address instead. That page reads them itself.
    detectSessionInUrl: isNative ? false : (url) => url.pathname !== ROUTES.verifyEdu,
    ...(isNative && { storage: capacitorPreferencesStorage }),
  },
})

/**
 * The current signed-in user's id, for scoping every query. Repositories
 * call this per-request (not once at module load) since the session can
 * change while the app is open. Routes are auth-gated, so in practice this
 * only throws if something calls a repository outside that guard.
 */
export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error('Not signed in.')
  }
  return data.user.id
}

/**
 * Throw the stored session away without asking the server first.
 *
 * `supabase.auth.signOut()` posts to /logout and, if that post fails for any
 * reason other than an expired token, returns the error *without* clearing
 * anything locally — so the person taps "Sign out", nothing happens, and
 * nothing says why. On a phone that is a common case: patchy signal, or a
 * refresh token that went stale while the app sat unopened. Signing out is a
 * local act as far as the person is concerned, so this makes sure it happens.
 */
export async function forgetStoredSession(): Promise<void> {
  const storage: SupportedStorage = isNative ? capacitorPreferencesStorage : window.localStorage
  for (const key of [AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`]) {
    try {
      await storage.removeItem(key)
    } catch {
      // Nothing to remove, or storage is unavailable. Either way the
      // in-memory session is dropped by the caller.
    }
  }
}
