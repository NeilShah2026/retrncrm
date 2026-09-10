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
 *
 * `@capacitor/preferences` is imported dynamically rather than at module
 * top: this file is reachable from supabase.ts in the shared web bundle
 * too, and a static import would ship the plugin's JS there even though
 * `isNative` gates it out of ever running.
 */
export const capacitorPreferencesStorage: SupportedStorage = {
  async getItem(key) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key })
    return value
  },
  async setItem(key, value) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key, value })
  },
  async removeItem(key) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key })
  },
}
