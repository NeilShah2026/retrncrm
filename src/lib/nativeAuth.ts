import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Where Supabase sends the browser back to after Google OAuth, a magic
 * link, or a signup confirmation — on native only. The web app keeps using
 * `${window.location.origin}/app` (see src/auth/AuthProvider.tsx); a native
 * app has no such origin to return to; a custom URL scheme is how iOS hands
 * control back from Safari/the OAuth browser to this app.
 *
 * This exact value must also be added to the project's Supabase dashboard
 * under Authentication → URL Configuration → Redirect URLs, or Supabase
 * will refuse to redirect here — that's a one-time manual step, since it
 * needs dashboard access this environment doesn't have.
 */
export const NATIVE_AUTH_REDIRECT_URL = 'com.neilshah.retrn://login-callback'

/**
 * Opens an auth URL (Google's consent screen, etc.) in the system browser.
 * `@capacitor/browser` is imported dynamically — this function is only ever
 * called from AuthProvider's `isNative` branch, but a static import would
 * still ship the plugin's JS in the shared web bundle otherwise.
 */
export async function openNativeAuthUrl(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

/**
 * Supabase's hosted verify endpoint 302s back to `NATIVE_AUTH_REDIRECT_URL`
 * with either `?code=…` (PKCE — what OAuth uses) or `#access_token=…&refresh_token=…`
 * (implicit — what magic links / signup confirmations use). Either shape
 * completes the sign-in; this tries both rather than assuming one flow type.
 */
async function completeSessionFromCallbackUrl(url: string): Promise<void> {
  const parsed = new URL(url)

  // A scanner-proof email link: /auth/confirm hands the unspent token hash
  // over when the person taps "Open in the Retrn app", and it's verified here.
  const tokenHash = parsed.searchParams.get('token_hash')
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (parsed.searchParams.get('type') as EmailOtpType | null) ?? 'email',
    })
    if (error) throw error
    return
  }

  const code = parsed.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return
  }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const access_token = hash.get('access_token')
  const refresh_token = hash.get('refresh_token')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) throw error
  }
}

/**
 * Registers the one listener that closes the loop on every native auth
 * flow (Google OAuth, magic link, signup confirmation): iOS hands the
 * `com.neilshah.retrn://login-callback…` URL to `appUrlOpen`, we pull the
 * session out of it, and `supabase.auth.onAuthStateChange` (already wired
 * in AuthProvider) does the rest — no navigation needed here, since
 * `RequireAuth`/`LoginPage` react to the session becoming non-null on their
 * own. Call once, from AuthProvider (already gated on `isNative`, so the
 * dynamic `@capacitor/app` import below only ever fires natively); returns
 * a cleanup function.
 */
export function listenForNativeAuthRedirect(): () => void {
  let removed = false
  let handle: { remove: () => void } | undefined

  void import('@capacitor/app').then(({ App: CapacitorApp }) => {
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith(NATIVE_AUTH_REDIRECT_URL)) return
      void completeSessionFromCallbackUrl(url)
        .catch((err: unknown) => {
          console.error('[native auth] failed to complete session from callback URL', err)
        })
        .finally(() => {
          void openBrowserModule().then((Browser) =>
            Browser?.close().catch(() => {
              // Nothing was open (e.g. a magic link opened straight in
              // Mail/Safari rather than through our Browser.open call).
            }),
          )
        })
    }).then((h) => {
      if (removed) h.remove()
      else handle = h
    })
  })

  return () => {
    removed = true
    handle?.remove()
  }
}

async function openBrowserModule() {
  const { Browser } = await import('@capacitor/browser')
  return Browser
}
