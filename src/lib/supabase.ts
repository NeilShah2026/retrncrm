import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isNative } from './platform'
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

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The native app completes auth via a custom-scheme redirect handled
    // by src/lib/nativeAuth.ts, not by Supabase reading `window.location` —
    // and there is no meaningful URL to detect a session in there anyway.
    detectSessionInUrl: !isNative,
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
