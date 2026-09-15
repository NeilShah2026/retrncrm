import type { Session } from '@supabase/supabase-js'
import { RETRN_APP_URLS } from './config'
import { LEGACY_SESSION_KEY, supabase } from './supabase'

/**
 * Signing in to the extension.
 *
 * The extension has its own session, created by a six-digit code sent to the
 * account's email (or a password, for accounts that have one). Earlier
 * versions copied the session out of an open Retrn tab instead. Supabase
 * rotates refresh tokens and treats a reused one as stolen, so the two copies
 * of that one token took turns invalidating each other: whichever side
 * refreshed second was signed out, and sometimes the whole session was
 * revoked, website included. A session of its own can't collide with anything.
 *
 * A code works however the account was created — Google, Apple, magic link or
 * password — because every account has a confirmed email.
 */

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
  if (msg.includes('token has expired') || (msg.includes('invalid') && msg.includes('token'))) {
    return 'That code is wrong or has expired. Check the newest email from Retrn, or send a new code.'
  }
  if (msg.includes('invalid login credentials')) {
    return 'That email and password don’t match. If you sign in with Google or Apple, use a code instead.'
  }
  if (msg.includes('rate limit') || msg.includes('security purposes')) {
    const seconds = raw.match(/(\d+)\s*seconds?/)?.[1]
    return seconds
      ? `Too many codes requested. Try again in ${seconds} seconds.`
      : 'Too many attempts. Wait a minute, then try again.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Couldn’t reach Retrn. Check your connection and try again.'
  }
  return raw || 'Something went wrong. Try again.'
}

export async function sendCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    // Sign-in only. Accounts are created on the website, where the terms and
    // the plan are.
    options: { shouldCreateUser: false },
  })
  if (error) throw new Error(authMessage(error))
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.replace(/\s/g, ''),
    type: 'email',
  })
  if (error) throw new Error(authMessage(error))
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw new Error(authMessage(error))
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
