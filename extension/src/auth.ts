import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { APP_ORIGIN, RETRN_APP_URLS } from './config'
import { LEGACY_SESSION_KEY, supabase } from './supabase'

/**
 * Signing in to the extension.
 *
 * The extension has its own session, created by a magic link sent to the
 * account's email (or a password, for accounts that have one). Earlier
 * versions copied the session out of an open Retrn tab instead. Supabase
 * rotates refresh tokens and treats a reused one as stolen, so the two copies
 * of that one token took turns invalidating each other: whichever side
 * refreshed second was signed out, and sometimes the whole session was
 * revoked, website included. A session of its own can't collide with anything.
 *
 * Opening the emailed link lands on the web app's /auth/confirm, carrying an
 * *unspent* `token_hash` — that page deliberately spends nothing until someone
 * taps its button, so email scanners can't burn the link (see
 * src/pages/auth/AuthConfirmPage.tsx). The background worker sees that tab
 * first and redeems the token for the extension instead
 * (`completeTokenSignIn`), then swaps the tab for the signed-in page.
 *
 * How it knows the link is *ours*: the extension is the only client on the
 * project that asks with PKCE (the website and the iPhone app use the implicit
 * flow), and Supabase prefixes a PKCE token hash with `pkce_`. A bare hash
 * belongs to a website or phone sign-in and is left alone.
 *
 * The `?code=` branch below is the older shape, from when the Magic Link
 * template used Supabase's own `{{ .ConfirmationURL }}`; it costs a few lines
 * and means reverting the template can't break sign-in again.
 *
 * A link works however the account was created — Google, Apple, magic link or
 * password — because every account has a confirmed email.
 */

/** A magic link the extension is waiting on. */
export type PendingSignIn = { email: string; sentAt: number }

const PENDING_KEY = 'retrn-extension-pending-sign-in'

/** Supabase's default email link lifetime. After this, a pending link is stale. */
const LINK_LIFETIME_MS = 60 * 60 * 1000

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Drops a session inherited from before 0.3, locally only. Returns true when
 * there was one, so the sign-in screen can say why it's asking.
 */
export async function retireLegacySession(): Promise<boolean> {
  const stored = await chrome.storage.local.get(LEGACY_SESSION_KEY)
  if (!stored[LEGACY_SESSION_KEY]) return false
  // Removed, not signed out: a sign-out would revoke the website's session,
  // which that copied token belongs to.
  await chrome.storage.local.remove(LEGACY_SESSION_KEY)
  return true
}

/** Turns Supabase's auth errors into something a person can act on. */
export function authMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const msg = raw.toLowerCase()
  if (msg.includes('signups not allowed') || msg.includes('user not found')) {
    return 'There’s no Retrn account with that email. Create one at retrncrm.com, then sign in here.'
  }
  if (
    msg.includes('expired') ||
    msg.includes('flow state') ||
    msg.includes('code verifier') ||
    msg.includes('code challenge') ||
    (msg.includes('invalid') && (msg.includes('token') || msg.includes('link')))
  ) {
    return 'That sign-in link has expired, was already used, or was replaced by a newer one. Open the Retrn extension and send a new link.'
  }
  if (msg.includes('invalid login credentials')) {
    return 'That email and password don’t match. If you sign in with Google or Apple, use an email link instead.'
  }
  if (msg.includes('rate limit') || msg.includes('security purposes')) {
    const seconds = raw.match(/(\d+)\s*seconds?/)?.[1]
    return seconds
      ? `Too many sign-in emails requested. Try again in ${seconds} seconds.`
      : 'Too many attempts. Wait a minute, then try again.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Couldn’t reach Retrn. Check your connection and try again.'
  }
  return raw || 'Something went wrong. Try again.'
}

export async function sendMagicLink(email: string): Promise<void> {
  const address = email.trim().toLowerCase()
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: {
      // Sign-in only. Accounts are created on the website, where the terms and
      // the plan are.
      shouldCreateUser: false,
      // The Magic Link template builds its own URL from the Site URL, so this
      // only matters if that template ever goes back to Supabase's
      // `{{ .ConfirmationURL }}`. It's an allowed redirect either way.
      emailRedirectTo: `${APP_ORIGIN}/app`,
    },
  })
  if (error) throw new Error(authMessage(error))
  await chrome.storage.local.set({ [PENDING_KEY]: { email: address, sentAt: Date.now() } satisfies PendingSignIn })
}

/** The link the extension is waiting on, if one was sent within the last hour. */
export async function getPendingSignIn(): Promise<PendingSignIn | null> {
  const stored = await chrome.storage.local.get(PENDING_KEY)
  const pending = stored[PENDING_KEY] as PendingSignIn | undefined
  if (!pending || Date.now() - pending.sentAt > LINK_LIFETIME_MS) return null
  return pending
}

export async function clearPendingSignIn(): Promise<void> {
  await chrome.storage.local.remove(PENDING_KEY)
}

/** What a tab's URL means for a pending sign-in. */
export type MagicLinkRedirect =
  /** The current shape: an unspent token on the web app's /auth/confirm. */
  | { kind: 'token'; tokenHash: string; type: EmailOtpType }
  /** The older shape, from Supabase's own `{{ .ConfirmationURL }}`. */
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }

/** Where the emailed link lands. Must match ROUTES.authConfirm in the web app. */
const CONFIRM_PATH = '/auth/confirm'

/**
 * Supabase prefixes a token hash with this when the link was asked for with
 * PKCE — which, on this project, only the extension does. It's what keeps the
 * worker from stealing a link meant for the website or the phone app.
 */
const EXTENSION_TOKEN_PREFIX = 'pkce_'

/**
 * What a tab's URL means for a pending magic link: the token or code to
 * redeem, the error Supabase redirected with, or nothing to do with the
 * extension.
 */
export function readMagicLinkRedirect(url: string): MagicLinkRedirect | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const origins = RETRN_APP_URLS.map((u) => new URL(u).origin)
  if (!origins.includes(parsed.origin)) return null

  if (parsed.pathname === CONFIRM_PATH) {
    const tokenHash = parsed.searchParams.get('token_hash')
    // A bare hash is somebody signing in to the website or the phone app.
    if (tokenHash?.startsWith(EXTENSION_TOKEN_PREFIX)) {
      return {
        kind: 'token',
        tokenHash,
        // The template sends `email`, which Supabase accepts for both halves
        // of a magic link; anything else it sends is passed through as-is.
        type: (parsed.searchParams.get('type') as EmailOtpType | null) ?? 'email',
      }
    }
  }

  const code = parsed.searchParams.get('code')
  if (code) return { kind: 'code', code }

  // Supabase puts errors in the query or the fragment depending on the flow.
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const error =
    parsed.searchParams.get('error_description') ??
    hash.get('error_description') ??
    parsed.searchParams.get('error_code') ??
    hash.get('error_code')
  return error ? { kind: 'error', message: error } : null
}

/**
 * Redeems the token from an opened sign-in link for the extension's session.
 * Throws with a message worth showing.
 *
 * This spends the link, so whoever gets here first wins: if someone taps
 * "Continue" on the /auth/confirm page before the worker finishes, the
 * *website* gets the session and this reports an expired link.
 */
export async function completeTokenSignIn(tokenHash: string, type: EmailOtpType): Promise<void> {
  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) throw new Error(authMessage(error))
  } finally {
    // A token is good once, whether or not it worked here.
    await clearPendingSignIn()
  }
}

/**
 * Redeems the code from an opened magic link for the extension's session.
 * Throws with a message worth showing.
 */
export async function completeMagicLink(code: string): Promise<void> {
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw new Error(authMessage(error))
  } finally {
    // A code is good once, and the verifier is gone either way.
    await clearPendingSignIn()
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw new Error(authMessage(error))
  await clearPendingSignIn()
}

/**
 * Signs the extension out, and only the extension. Supabase's default scope is
 * global, which would also sign you out of the website and the phone app.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
}

/**
 * The email of whoever is signed in on an open Retrn tab, to pre-fill the
 * sign-in form. Reads the address and nothing else; no token leaves the tab.
 */
export async function suggestEmail(): Promise<string | null> {
  try {
    const origins = RETRN_APP_URLS.map((u) => new URL(u).origin)
    const tabs = await chrome.tabs.query({ url: origins.map((o) => `${o}/*`) })
    for (const tab of tabs) {
      if (!tab.id) continue
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
            try {
              const parsed = JSON.parse(localStorage.getItem(key) ?? '')
              const email = (parsed.user ?? parsed.currentSession?.user)?.email
              if (typeof email === 'string') return email
            } catch {
              // Not a session entry.
            }
          }
          return null
        },
      })
      if (typeof res?.result === 'string') return res.result
    }
  } catch {
    // No permission for that tab, or it navigated away mid-read.
  }
  return null
}
