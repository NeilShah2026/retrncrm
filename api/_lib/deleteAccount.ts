import { createClient } from '@supabase/supabase-js'
import { withCors } from './cors.js'
import { stripe, StripeError } from './stripe.js'

/**
 * Permanent account deletion, as the App Store requires it.
 *
 * App Review Guideline 5.1.1(v): an app that lets people create an account
 * must let them *delete* that account from inside the app — not hide it
 * behind an email to support, and not merely deactivate it. This endpoint is
 * what the "Delete Account" row in Settings calls.
 *
 * It has to run on the server with the service role, because deleting an
 * `auth.users` row is an admin operation: a signed-in user's own token can
 * clear their data but cannot remove their identity. Every table in
 * `supabase/migrations/` references `auth.users(id) on delete cascade`, so
 * removing that one row takes contacts, tags, opportunities, templates,
 * events, calendar tokens and edu verifications with it. The cascade is the
 * deletion — there is no list here to keep in sync with the schema.
 *
 * The caller proves who they are with their own access token, and the account
 * deleted is always the token's own. There is deliberately no "delete user X"
 * parameter: no input can name a different account.
 */

function env() {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = env()
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: 'Account deletion is not configured on this deployment.' }, 500)
  }

  const header = req.headers.get('authorization') ?? ''
  const accessToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!accessToken) {
    return json({ error: 'Sign in to delete your account.' }, 401)
  }

  // Validated against the project with the anon key, exactly as verify-edu
  // does: a forged or expired token resolves to no user and gets nothing.
  const reader = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: caller, error: callerError } = await reader.auth.getUser(accessToken)
  if (callerError || !caller.user) {
    return json({ error: 'Sign in to delete your account.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // A hard delete, not `shouldSoftDelete` — Apple's requirement is that the
  // account and its data are actually gone, not flagged as inactive.
  // A web subscription is billed by Stripe, not by the row we are about to
  // cascade away — deleting the account without cancelling it would keep
  // charging a card for an account that no longer exists. If Stripe can't be
  // reached, stop: an account deleted with a live subscription can't be
  // cancelled from inside the app ever again.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', caller.user.id)
    .maybeSingle()
  if (
    sub?.stripe_subscription_id &&
    ['active', 'trialing', 'past_due', 'incomplete', 'unpaid'].includes(sub.status ?? '')
  ) {
    try {
      await stripe('DELETE', `/subscriptions/${sub.stripe_subscription_id}`)
    } catch (err) {
      // Already cancelled on Stripe's side: nothing left to stop.
      const gone = err instanceof StripeError && err.status === 404
      if (!gone) {
        console.error('[delete-account] could not cancel Stripe subscription', err)
        return json(
          { error: 'Could not cancel your subscription, so nothing was deleted. Please try again.' },
          502,
        )
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(caller.user.id)
  if (error) {
    console.error('[delete-account] failed', error)
    return json({ error: 'Could not delete your account. Please try again.' }, 500)
  }

  return json({ deleted: true }, 200)
}

export const handleDeleteAccountRequest = withCors(handle)
