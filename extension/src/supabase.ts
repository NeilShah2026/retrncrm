import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

/**
 * Auth storage in `chrome.storage.local`, so one session is shared by every
 * part of the extension — the popup, the panel inside Gmail/Outlook, and the
 * background worker — and survives the popup closing.
 */
const chromeStorage: SupportedStorage = {
  async getItem(key) {
    const res = await chrome.storage.local.get(key)
    return (res[key] as string | undefined) ?? null
  },
  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },
  async removeItem(key) {
    await chrome.storage.local.remove(key)
  },
}

/**
 * Where this extension's own session lives. Deliberately not Supabase's
 * default key: versions before 0.3 stored a session *copied from the website*
 * under that key, and sharing one refresh token between two apps is what
 * broke sign-in (see src/auth.ts). A new key means that copy is never used
 * again.
 */
export const SESSION_KEY = 'retrn-extension-session'
export const LEGACY_SESSION_KEY = 'sb-plkpfojzqsgfqpfeeasf-auth-token'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorage,
    storageKey: SESSION_KEY,
    persistSession: true,
    autoRefreshToken: true,
    // Nothing redirects back into the extension, so there's no URL to read.
    detectSessionInUrl: false,
  },
})
