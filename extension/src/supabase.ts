import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

/**
 * A Supabase auth-storage adapter backed by chrome.storage.local, so the
 * signed-in session survives popup close/reopen and works across the
 * extension (popup + any future background worker) — regular localStorage in
 * a popup is fine, but chrome.storage is the robust cross-context choice.
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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    // The extension is not a redirect target, so don't try to parse URLs.
    detectSessionInUrl: false,
  },
})
