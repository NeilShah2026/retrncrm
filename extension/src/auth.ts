import type { Session } from '@supabase/supabase-js'
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
 * The link is requested with PKCE. Opening it redirects to the web app with a
 * `?code=` that only the verifier in the extension's storage can redeem; the
 * background worker spots that tab and redeems it (`completeMagicLink`). The
 * web app ignores a code it has no verifier for.
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
    return 'That sign-in link has expired or was replaced by a newer one. Open the Retrn extension and send a new link.'
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
      // The same place the website sends its own links, so it's already an
      // allowed redirect. The code on the end is what the extension redeems.
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

/**
 * What a tab's URL means for a pending magic link: the code to redeem, the
 * error Supabase redirected with, or nothing to do with the extension.
 */
export function readMagicLinkRedirect(url: string): { code: string } | { error: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const origins = RETRN_APP_URLS.map((u) => new URL(u).origin)
  if (!origins.includes(parsed.origin)) return null

  const code = parsed.searchParams.get('code')
  if (code) return { code }

  // Supabase puts errors in the query or the fragment depending on the flow.
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const error =
    parsed.searchParams.get('error_description') ??
    hash.get('error_description') ??
    parsed.searchParams.get('error_code') ??
    hash.get('error_code')
  return error ? { error } : null
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
