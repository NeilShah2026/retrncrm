import {
  createClient,
  type EmailOtpType,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import { supabase } from './supabase'
import { postApi } from './apiFetch'
import { emailLinkOrigin } from './apiBase'
import { ROUTES } from './routes'

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
 *     address. `startVerification()` records the request server-side and
 *     emails a magic link to the Babson address. Opening that link — on any
 *     device — lands on /verify-edu, which hands the proof to `claimLink()`.
 *     Pasting the link (or a code, if the email template has one) into
 *     Settings via `confirmVerification()` still works as a fallback.
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

async function callVerifyEndpoint(
  body: Record<string, unknown>,
  { refresh = true }: { refresh?: boolean } = {},
): Promise<VerifyResponse> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in first.')

  const payload = await postVerify(body, token)

  // `app_metadata` rides in the JWT, so the change is invisible until the
  // session is re-minted. Everything reading `readEduStatus` updates on this.
  if (refresh) await supabase.auth.refreshSession()
  return payload
}

async function postVerify(body: Record<string, unknown>, token?: string): Promise<VerifyResponse> {
  const res = await postApi('/api/verify-edu', body, token ? { token } : {})

  let payload: VerifyResponse = {}
  try {
    payload = (await res.json()) as VerifyResponse
  } catch {
    // Fall through to the status-based message below.
  }
  if (!res.ok) {
    throw new Error(payload.error ?? 'Verification failed. Try again in a moment.')
  }
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
      // Implicit, not PKCE: the link has to carry the session itself in its
      // #fragment, because it may be opened on a device that never held a
      // PKCE verifier (and this client keeps nothing between page loads).
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'retrn-edu-verify',
    },
  })
  return otp
}

/**
 * What the student pasted back from the verification email.
 *
 * Supabase sends *one* email whose content is decided by the project's email
 * template, and the same template serves the sign-in magic link on the login
 * page. So depending on how that template is written, the email may carry a
 * six-digit code, a link, or both — and this flow has to work either way
 * rather than insisting on the one the template happens to contain today.
 *
 * Both forms prove the same thing: control of the address. A code is the
 * token itself; a link carries the same token pre-hashed in its query string,
 * along with the grant type that minted it.
 */
export type VerificationInput =
  | { kind: 'code'; token: string }
  | { kind: 'link'; tokenHash: string; type: EmailOtpType }

/** The grant types a Supabase email link can carry, and what to assume. */
function otpTypeFrom(raw: string | null): EmailOtpType {
  switch (raw) {
    case 'magiclink':
    case 'signup':
    case 'invite':
    case 'recovery':
    case 'email_change':
      return raw
    default:
      // `email` covers a code from either a sign-up confirmation or a magic
      // link, which is what `signInWithOtp` produces here.
      return 'email'
  }
}

function asUrl(raw: string): URL | null {
  // Mail clients love to wrap a URL in <angle brackets> or leave a trailing
  // full stop or paren on it.
  const cleaned = raw.replace(/^[<([]+/, '').replace(/[>)\].,]+$/, '')
  try {
    const url = new URL(cleaned)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/**
 * Read whatever was pasted into the box: a code, or the whole verification
 * link out of the email. Returns `null` when it is neither, so the caller can
 * say something specific rather than sending nonsense to the server.
 */
export function parseVerificationInput(raw: string): VerificationInput | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // A bare code, however the student spaced or hyphenated it.
  const digits = trimmed.replace(/[\s-]/g, '')
  if (/^\d{6,10}$/.test(digits)) return { kind: 'code', token: digits }

  const url = asUrl(trimmed)
  if (url) {
    const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token')
    if (tokenHash) {
      return { kind: 'link', tokenHash, type: otpTypeFrom(url.searchParams.get('type')) }
    }
  }

  return null
}

/** Email a verification link to `email`. Throws a showable message. */
export async function startVerification(email: string): Promise<void> {
  const address = email.trim().toLowerCase()
  if (!isBabsonEmail(address)) {
    throw new Error(`Enter your @${BABSON_DOMAIN} address.`)
  }

  // Record which account is asking first, so the link can be matched back to
  // it wherever it's opened.
  await callVerifyEndpoint({ action: 'request', email: address }, { refresh: false })

  const { error } = await otpClient().auth.signInWithOtp({
    email: address,
    options: {
      // Babson students verifying from a personal account usually have no
      // Retrn account under their school address, so one has to be creatable
      // for the email to be sent at all.
      shouldCreateUser: true,
      // An absolute web URL even from the iPhone app: the link opens in the
      // browser, which is where /verify-edu lives. Must be in the Supabase
      // project's Redirect URLs, or Supabase falls back to the Site URL.
      emailRedirectTo: `${emailLinkOrigin()}${ROUTES.verifyEdu}`,
    },
  })
  if (error) throw new Error(error.message)
}

/**
 * What /verify-edu found in its URL.
 *
 * `hash` is the normal case: the email template links straight here with a
 * token hash, and nothing is spent until the student presses the button.
 * That matters because school mail (Babson is on Microsoft 365) runs every
 * link through a scanner that opens it first — a link that verifies on open
 * gets used up by the scanner, and the student's own click then reads
 * "invalid or expired". `token` is the stock Supabase link, which verifies on
 * open and hands over a session in the #fragment.
 */
export type LandingLink =
  | { kind: 'hash'; tokenHash: string; type: EmailOtpType }
  | { kind: 'token'; accessToken: string }

export function readLandingUrl(url: URL): LandingLink {
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const failure = hash.get('error_description') ?? url.searchParams.get('error_description')
  if (failure) throw new Error(failure.replace(/\+/g, ' '))

  const tokenHash = url.searchParams.get('token_hash')
  if (tokenHash) {
    return { kind: 'hash', tokenHash, type: otpTypeFrom(url.searchParams.get('type')) }
  }

  const accessToken = hash.get('access_token')
  if (accessToken) return { kind: 'token', accessToken }

  throw new Error('This link is incomplete. Open it straight from the email, or send a new one.')
}

/** Spend the link: the school account's access token, as proof for the server. */
export async function proofFromLanding(link: LandingLink): Promise<string> {
  if (link.kind === 'token') return link.accessToken
  const { data, error } = await otpClient().auth.verifyOtp({
    token_hash: link.tokenHash,
    type: link.type,
  })
  if (error) throw new Error(error.message)
  const token = data.session?.access_token
  if (!token) throw new Error('That link could not be confirmed. Send a new one from Settings.')
  return token
}

/** Which Retrn account a link would verify, before committing to it. */
export async function previewLink(
  proofToken: string,
): Promise<{ email: string; account: string | null }> {
  const res = (await postVerify({ action: 'claim', proofToken, preview: true })) as {
    email?: string
    account?: string | null
  }
  return { email: res.email ?? '', account: res.account ?? null }
}

/** Verify the account that asked for this address. Needs no Retrn session. */
export async function claimLink(proofToken: string): Promise<string> {
  const res = await postVerify({ action: 'claim', proofToken })
  // If the account that asked is signed in in this browser too, show it now.
  const { data } = await supabase.auth.getSession()
  if (data.session) await supabase.auth.refreshSession()
  return res.email ?? ''
}

/**
 * Check what came back from the email — a code or a pasted link — and, on
 * success, record the verification against the account the user is actually
 * signed in as. Returns the verified address.
 */
export async function confirmVerification(email: string, entry: string): Promise<string> {
  const address = email.trim().toLowerCase()
  const input = parseVerificationInput(entry)
  if (!input) {
    throw new Error('Paste the whole link from the email.')
  }

  const client = otpClient()
  // A code is checked against the address it was sent to; a link's token hash
  // already identifies the address on the server, and passing an email
  // alongside it is rejected as an over-specified request.
  const { data, error } = await client.auth.verifyOtp(
    input.kind === 'code'
      ? { email: address, token: input.token, type: 'email' }
      : { token_hash: input.tokenHash, type: input.type },
  )
  if (error) throw new Error(error.message)

  const proofToken = data.session?.access_token
  if (!proofToken) throw new Error('That could not be confirmed. Ask for a new email and retry.')

  // A pasted link proves control of whatever address it was issued to, which
  // is not necessarily the one typed into the form. Check what was actually
  // proven before treating it as this student's school address.
  const proven = data.user?.email?.toLowerCase() ?? null
  if (!isBabsonEmail(proven)) {
    await client.auth.signOut({ scope: 'local' })
    throw new Error(`That link isn't for an @${BABSON_DOMAIN} address.`)
  }

  try {
    const result = await callVerifyEndpoint({ proofToken })
    // The server reads the address out of the proof token itself, so prefer
    // its answer over the one typed into the form.
    return result.email ?? proven ?? address
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
