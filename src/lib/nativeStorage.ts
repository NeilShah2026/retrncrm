import { Preferences } from '@capacitor/preferences'
import type { SupportedStorage } from '@supabase/supabase-js'

/**
 * Supabase's auth `storage` option, backed by `@capacitor/preferences`
 * (iOS's `UserDefaults`) instead of the WebView's `localStorage` — the
 * storage adapter Supabase's own Capacitor guide recommends. WKWebView's
 * `localStorage` does work and does persist, but it's on-disk *WebKit*
 * storage, sitting alongside cache data iOS is allowed to purge under
 * storage pressure; `UserDefaults` is the OS's own durable per-app
 * key/value store, so the session survives exactly as reliably as any
 * other native app's "stay signed in" state. Only wired in on native (see
 * src/lib/supabase.ts) — web keeps the default `localStorage`.
 */
export const capacitorPreferencesStorage: SupportedStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key })
    return value
  },
  async setItem(key, value) {
    await Preferences.set({ key, value })
  },
  async removeItem(key) {
    await Preferences.remove({ key })
  },
}
