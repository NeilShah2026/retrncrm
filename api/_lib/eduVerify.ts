import { createClient } from '@supabase/supabase-js'

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

interface RequestBody {
  action?: unknown
  proofToken?: unknown
}

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

export async function handleVerifyEduRequest(req: Request): Promise<Response> {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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

  // --- One address unlocks one account ------------------------------------
  const { data: existing } = await admin
    .from('edu_verifications')
    .select('user_id')
    .ilike('email', email)
    .maybeSingle()

  if (existing && existing.user_id !== userId) {
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

  return json({ verified: true, email, via }, 200)
}
