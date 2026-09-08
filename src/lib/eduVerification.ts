import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Babson free access: any student who proves control of a @babson.edu address
 * gets every paid feature at no charge.
 *
 * There are two ways to prove it, and both end at the same place — the
 * server-only `/api/verify-edu` endpoint, which stamps `babson_verified` into
 * auth `app_metadata` and writes an `edu_verifications` row:
 *
 *  1. **Sign in with the Babson address.** Password, magic link, or Google
 *     with a @babson.edu account — Supabase has already confirmed the address,
 *     so there is nothing more to ask for. `syncAccountEmail()` records it.
 *
 *  2. **Verify it in Settings.** For people whose Retrn account is a personal
 *     address. `startVerification()` sends a code to the Babson address and
 *     `confirmVerification()` checks it, without disturbing the session they
 *     are signed in with — see `otpClient()` below.
 *
 * Nothing here is trusted on its own: the flag this module reads is written by
 * the service role and travels in the JWT, so a user cannot set it themselves.
 */

/** Domains that earn free access. The authoritative copy is in api/_lib/eduVerify.ts. */
const FREE_DOMAINS = ['babson.edu'] as const

export const BABSON_DOMAIN = 'babson.edu'

/** True for the domain itself and any subdomain of it (@mail.babson.edu). */
export function isBabsonEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase().trim()
  return FREE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export interface EduStatus {
  /** Whether this account has free access through the Babson offer. */
  verified: boolean
  /** The Babson address behind it, if any. */
  email: string | null
  /**
   * How it was earned. `account-email` means they signed in with the Babson
   * address itself; `verified-email` means they confirmed a code in Settings.
   */
  via: 'account-email' | 'verified-email' | null
}

/**
 * Read verification off a session user.
 *
 * `app_metadata` is the trusted source — only the service role can write it.
 * We additionally treat a confirmed @babson.edu *account* email as verified so
 * the offer applies from the first second of the first sign-in, before
 * `syncAccountEmail()` has had a chance to round-trip; that fact comes from
 * Supabase's own JWT claims, so it is just as trustworthy.
 */
export function readEduStatus(user: User | null | undefined): EduStatus {
  if (!user) return { verified: false, email: null, via: null }

  const meta = (user.app_metadata ?? {}) as Record<string, unknown>
  if (meta.babson_verified === true) {
    const stamped = typeof meta.babson_email === 'string' ? meta.babson_email : null
    const isOwnEmail = Boolean(stamped && stamped === user.email?.toLowerCase())
    return {
      verified: true,
      email: stamped ?? user.email ?? null,
      via: isOwnEmail ? 'account-email' : 'verified-email',
    }
  }

  if (isBabsonEmail(user.email) && user.email_confirmed_at) {
    return { verified: true, email: user.email?.toLowerCase() ?? null, via: 'account-email' }
  }

  return { verified: false, email: null, via: null }
}

// --- Talking to the endpoint ------------------------------------------------

interface VerifyResponse {
  verified?: boolean
  email?: string
  error?: string
}

async function callVerifyEndpoint(body: Record<string, unknown>): Promise<VerifyResponse> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in first.')

  const res = await fetch('/api/verify-edu', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  let payload: VerifyResponse = {}
  try {
    payload = (await res.json()) as VerifyResponse
  } catch {
    // Fall through to the status-based message below.
  }
  if (!res.ok) {
    throw new Error(payload.error ?? 'Verification failed. Try again in a moment.')
  }

  // `app_metadata` rides in the JWT, so the change is invisible until the
  // session is re-minted. Everything reading `readEduStatus` updates on this.
  await supabase.auth.refreshSession()
  return payload
}

// --- The throwaway OTP client ----------------------------------------------

let otp: SupabaseClient | null = null

/**
 * A second Supabase client used only to send and check the code, kept entirely
 * separate from the app's session.
 *
 * Verifying a code signs you in *as that address* — which for a personal
 * account would silently swap the user out from under the app. So this client
 * persists nothing, refreshes nothing, and ignores tokens in the URL: the
 * session it mints lives in a local variable just long enough to hand the
 * access token to `/api/verify-edu` as proof, then is thrown away.
 */
function otpClient(): SupabaseClient {
  if (otp) return otp
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  otp = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'retrn-edu-verify',
    },
  })
  return otp
}

/** Email a six-digit code to `email`. Throws with a message worth showing. */
export async function startVerification(email: string): Promise<void> {
  const address = email.trim().toLowerCase()
  if (!isBabsonEmail(address)) {
    throw new Error(`Enter your @${BABSON_DOMAIN} address.`)
  }

  const { error } = await otpClient().auth.signInWithOtp({
    email: address,
    // Babson students verifying from a personal account usually have no Retrn
    // account under their school address, so one has to be creatable for the
    // code to be sent at all.
    options: { shouldCreateUser: true },
  })
  if (error) throw new Error(error.message)
}

/**
 * Check the code and, on success, record the verification against the account
 * the user is actually signed in as. Returns the verified address.
 */
export async function confirmVerification(email: string, code: string): Promise<string> {
  const address = email.trim().toLowerCase()
  const token = code.replace(/\s/g, '')

  const client = otpClient()
  const { data, error } = await client.auth.verifyOtp({
    email: address,
    token,
    type: 'email',
  })
  if (error) throw new Error(error.message)

  const proofToken = data.session?.access_token
  if (!proofToken) throw new Error('That code could not be confirmed. Try again.')

  try {
    const result = await callVerifyEndpoint({ proofToken })
    return result.email ?? address
  } finally {
    // Drop the throwaway session locally. `local` scope on purpose: a global
    // sign-out would revoke the school account's own real sessions elsewhere.
    await client.auth.signOut({ scope: 'local' })
  }
}

/** Give up the free access tied to this account (e.g. wrong address). */
export async function removeVerification(): Promise<void> {
  await callVerifyEndpoint({ action: 'remove' })
}

/**
 * Record the offer for someone whose account email *is* a Babson address, so
 * the badge and the `edu_verifications` row exist without them doing anything.
 * Safe to call repeatedly; failures are silent because `readEduStatus` already
 * grants access from the confirmed account email alone.
 */
const synced = new Set<string>()

export async function syncAccountEmail(user: User): Promise<void> {
  if (synced.has(user.id)) return
  if ((user.app_metadata as Record<string, unknown> | undefined)?.babson_verified === true) {
    return
  }
  if (!isBabsonEmail(user.email) || !user.email_confirmed_at) return

  synced.add(user.id)
  try {
    await callVerifyEndpoint({})
  } catch {
    // Best-effort bookkeeping — allow a retry on the next sign-in.
    synced.delete(user.id)
  }
}
