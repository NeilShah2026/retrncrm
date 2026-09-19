import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withCors } from './cors.js'

/**
 * The one implementation of school-email verification. `api/verify-edu.ts` is
 * the Vercel edge entry point; the dev middleware in `vite.config.ts` calls
 * this same function, so `vite dev` and production can't drift apart.
 *
 * Why a server endpoint at all: verification is what unlocks paid features, so
 * the flag has to live somewhere the browser cannot write. It goes in auth
 * `app_metadata` (service-role only, and carried in the JWT) plus a row in
 * `edu_verifications` — never in `user_metadata`, which any signed-in user can
 * overwrite with `updateUser`.
 *
 * Two ways in, both proving control of the address:
 *
 *  1. The account's own email is already a school address and confirmed —
 *     signing in with @babson.edu (password, magic link, or Google) is itself
 *     the proof. The browser sends no `proofToken` and we read `user.email`.
 *
 *  2. The account signs in with something else and verifies from Settings. The
 *     browser runs a throwaway email-OTP flow against the school address (see
 *     src/lib/eduVerification.ts) and sends us the resulting access token as
 *     `proofToken`. We re-verify that token here — a token minted by Supabase
 *     for a confirmed @babson.edu address is proof the code was received.
 *
 * Files under `api/_lib/` are ignored by Vercel's function router (leading
 * underscore), so this ships as a module, not a second endpoint.
 */

/**
 * Read per-request rather than at import time: the Vite dev plugin loads
 * `.env` into `process.env` after this module has already been imported.
 */
function env() {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    supabaseAnonKey:
      process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  }
}

/**
 * Domains that currently earn free access. There is a copy of this list in
 * src/lib/eduVerification.ts, but that one only decides what to *show* — this
 * is the rule that actually grants anything.
 */
const FREE_DOMAINS = ['babson.edu'] as const

const MAX_BODY_BYTES = 4_000

/** How long an emailed link stays good for matching back to an account. */
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000

interface RequestBody {
  action?: unknown
  proofToken?: unknown
  email?: unknown
  /** With `claim`: only say which account the link would verify. */
  preview?: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', 'public', any, any>

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** True for the domain itself and any subdomain of it (@mail.babson.edu). */
function isFreeDomain(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase()
  return FREE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase()
}

/** "neil@gmail.com" → "n***@gmail.com": enough to recognise, not to harvest. */
function maskEmail(email: string | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  return `${email[0]}***${email.slice(at)}`
}

/**
 * Tie `email` to `userId`: the `edu_verifications` row plus the JWT flag.
 * Returns an error response, or null on success.
 */
async function grant(admin: AdminClient, userId: string, email: string): Promise<Response | null> {
  // One address unlocks one account.
  const { data: existing } = await admin
    .from('edu_verifications')
    .select('user_id')
    .ilike('email', email)
    .maybeSingle()

  if (existing && (existing as { user_id: string }).user_id !== userId) {
    return json(
      { error: 'That Babson email is already verified on another Retrn account.' },
      409,
    )
  }

  const verifiedAt = new Date().toISOString()

  const { error: rowError } = await admin.from('edu_verifications').upsert(
    { user_id: userId, email, domain: domainOf(email), verified_at: verifiedAt },
    { onConflict: 'user_id' },
  )
  if (rowError) {
    return json({ error: 'Could not record that verification.' }, 500)
  }

  // The flag the app actually reads. app_metadata rides along in the JWT, so
  // the browser sees it after one `refreshSession()`.
  const { error: stampError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      babson_verified: true,
      babson_email: email,
      babson_verified_at: verifiedAt,
    },
  })
  if (stampError) {
    return json({ error: 'Could not update your account.' }, 500)
  }
  return null
}

/**
 * The emailed link was opened: `proofToken` is the session Supabase minted for
 * the school address. Find the account that asked for that address and verify
 * it. Needs no Retrn session — the link may be opened on a different device.
 */
async function handleClaim(
  reader: AdminClient,
  admin: AdminClient,
  body: RequestBody,
): Promise<Response> {
  if (typeof body.proofToken !== 'string' || !body.proofToken.trim()) {
    return json({ error: 'That link is missing its verification token.' }, 400)
  }
  const { data: proof, error: proofError } = await reader.auth.getUser(body.proofToken.trim())
  if (proofError || !proof.user?.email || !proof.user.email_confirmed_at) {
    return json({ error: 'That link has expired or was already used. Send a new one from Settings.' }, 401)
  }
  const email = proof.user.email.toLowerCase()
  if (!isFreeDomain(email)) {
    return json({ error: 'That link isn’t for a Babson address.' }, 400)
  }

  const { data: request } = await admin
    .from('edu_verification_requests')
    .select('user_id, requested_at')
    .ilike('email', email)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const pending = request as { user_id: string; requested_at: string } | null
  if (!pending || Date.now() - new Date(pending.requested_at).getTime() > REQUEST_TTL_MS) {
    return json(
      { error: 'No Retrn account is waiting on this address. Start again from Settings.' },
      404,
    )
  }

  if (body.preview === true) {
    const { data: account } = await admin.auth.admin.getUserById(pending.user_id)
    return json({ email, account: maskEmail(account.user?.email) }, 200)
  }

  const failed = await grant(admin, pending.user_id, email)
  if (failed) return failed

  await admin.from('edu_verification_requests').delete().eq('user_id', pending.user_id)
  return json({ verified: true, email, via: 'verified-email' }, 200)
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = env()
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json(
      { error: 'School verification is not configured on this deployment.' },
      503,
    )
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'That request is too large.' }, 413)
  }

  let body: RequestBody = {}
  if (raw.trim()) {
    try {
      body = JSON.parse(raw) as RequestBody
    } catch {
      return json({ error: 'Malformed request body.' }, 400)
    }
  }

  // Tokens are read with the anon key — `getUser(token)` validates the JWT
  // against the project and returns the live user, so a forged or expired
  // token gets us nothing.
  const reader = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Claim (the emailed link was opened, maybe on another device) --------
  if (body.action === 'claim') return handleClaim(reader, admin, body)

  const header = req.headers.get('authorization') ?? ''
  const accessToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!accessToken) {
    return json({ error: 'Sign in to verify a school email.' }, 401)
  }

  const { data: caller, error: callerError } = await reader.auth.getUser(accessToken)
  if (callerError || !caller.user) {
    return json({ error: 'Sign in to verify a school email.' }, 401)
  }
  const userId = caller.user.id

  // --- Request (about to email a link to a school address) ----------------
  if (body.action === 'request') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!isFreeDomain(email)) {
      return json({ error: 'That is not a Babson address. Use your @babson.edu email.' }, 400)
    }
    const { data: taken } = await admin
      .from('edu_verifications')
      .select('user_id')
      .ilike('email', email)
      .maybeSingle()
    if (taken && (taken as { user_id: string }).user_id !== userId) {
      return json(
        { error: 'That Babson email is already verified on another Retrn account.' },
        409,
      )
    }
    const { error } = await admin.from('edu_verification_requests').upsert(
      { user_id: userId, email, requested_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) return json({ error: 'Could not start verification. Try again in a moment.' }, 500)
    return json({ requested: true }, 200)
  }

  // --- Remove -------------------------------------------------------------
  if (body.action === 'remove') {
    await admin.from('edu_verifications').delete().eq('user_id', userId)
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        babson_verified: false,
        babson_email: null,
        babson_verified_at: null,
      },
    })
    if (error) return json({ error: 'Could not update your account.' }, 500)
    return json({ verified: false }, 200)
  }

  // --- Establish which address was actually proven ------------------------
  let email: string
  let via: 'account-email' | 'verified-email'

  if (typeof body.proofToken === 'string' && body.proofToken.trim()) {
    const { data: proof, error: proofError } = await reader.auth.getUser(
      body.proofToken.trim(),
    )
    if (proofError || !proof.user?.email) {
      return json({ error: 'That verification code could not be confirmed.' }, 401)
    }
    if (!proof.user.email_confirmed_at) {
      return json({ error: 'That address has not been confirmed yet.' }, 400)
    }
    email = proof.user.email.toLowerCase()
    via = 'verified-email'
  } else {
    if (!caller.user.email || !caller.user.email_confirmed_at) {
      return json(
        { error: 'Confirm your account email first, or verify a school email.' },
        400,
      )
    }
    email = caller.user.email.toLowerCase()
    via = 'account-email'
  }

  if (!isFreeDomain(email)) {
    return json(
      { error: 'That is not a Babson address. Use your @babson.edu email.' },
      400,
    )
  }

  const failed = await grant(admin, userId, email)
  if (failed) return failed

  return json({ verified: true, email, via }, 200)
}


/** The exported entry point: preflight-aware, so the iOS app can call it. */
export const handleVerifyEduRequest = withCors(handle)
