import type { PostHog } from 'posthog-js'
import type { User } from '@supabase/supabase-js'
import { isNative, nativePlatform } from '@/lib/platform'
import { PRODUCTION_ORIGIN } from '@/lib/apiBase'

/**
 * Product analytics (PostHog).
 *
 * Retrn holds other people's names, emails and private notes about them, so
 * this is deliberately the narrow kind of analytics:
 *
 *  - **No autocapture.** PostHog's automatic click tracking records the text
 *    of whatever was clicked — in this app that is contact names, company
 *    names, note snippets. Every event here is written by hand instead.
 *  - **No session recording.** It would film the contents of the CRM.
 *  - **No personal data in properties.** Accounts are identified by their
 *    Supabase user id. Never an email, a name, or anything typed into a
 *    record. Counts and enum-ish labels only.
 *  - **Paths are masked** before they are sent: /app/contacts/<uuid> becomes
 *    /app/contacts/:id, so a URL can't carry a record id into the analytics.
 *  - **Off unless configured.** With no VITE_POSTHOG_KEY every function here
 *    is a no-op, which is what local development and any fork gets.
 *
 * A person can switch it off entirely — see `setAnalyticsOptOut`, wired to a
 * Settings toggle, and honoured on this device from then on.
 *
 * The library is loaded on demand, in a chunk of its own: it is a couple of
 * hundred kilobytes, nothing renders without it, and a build with no key
 * configured must not ship it at all. Events raised before it arrives are
 * queued, so the first page view of a cold start still counts.
 */

/**
 * The first of these that actually holds something.
 *
 * A variable declared but left blank — `VITE_POSTHOG_HOST=` in a .env file, or
 * an empty value saved in Vercel — is an empty string, not undefined, so `??`
 * would happily take it and leave the app pointing at nowhere. Treat blank as
 * "not set", which is what anyone writing it meant.
 */
function firstSet(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

/**
 * The public project key — the `phc_…` one. PostHog's own setup calls it both
 * "project API key" and "project token", so both spellings are accepted here
 * rather than making a name mismatch look like broken analytics.
 *
 * Never a personal API key (`phx_…`): everything with a VITE_ prefix is
 * compiled into the bundle every visitor downloads, and a personal key can
 * read and write the whole PostHog account.
 */
const KEY = firstSet(
  import.meta.env.VITE_POSTHOG_KEY,
  import.meta.env.VITE_POSTHOG_PROJECT_TOKEN,
)
/**
 * Where events are sent.
 *
 * By default, our own domain: `/ingest` is rewritten to PostHog by Vercel
 * (see vercel.json) and by `vite dev`. That exists because ad blockers block
 * posthog.com by name — a request to our own origin isn't on any blocklist,
 * so the 10–30% of people running a blocker stop being invisible.
 *
 * The native app has no origin of its own (`capacitor://localhost`), so a
 * relative path would go nowhere; it uses the production domain's proxy.
 *
 * VITE_POSTHOG_HOST overrides all of it — set it to https://us.i.posthog.com
 * to bypass the proxy, or to the EU host if the project is EU-hosted (and
 * change the two destinations in vercel.json to match).
 */
const HOST =
  firstSet(import.meta.env.VITE_POSTHOG_HOST) ||
  (isNative ? `${PRODUCTION_ORIGIN}/ingest` : '/ingest')

/** Where PostHog itself lives, for links out of the toolbar. */
const UI_HOST = 'https://us.posthog.com'

let started = false
let client: PostHog | null = null

/** Calls made before the library finished loading. Bounded, then dropped. */
const queued: ((ph: PostHog) => void)[] = []
const MAX_QUEUED = 25

function withClient(fn: (ph: PostHog) => void): void {
  if (!KEY || !started) return
  if (client) {
    fn(client)
    return
  }
  if (queued.length < MAX_QUEUED) queued.push(fn)
}

/** Whether anything is sent at all. */
export function isAnalyticsEnabled(): boolean {
  return Boolean(KEY)
}

/**
 * What the analytics are actually doing, for the status row in Settings.
 *
 * Without this, "no key" and "key fine, events failing" look identical from
 * the outside — both are silence — and the first thing anyone does is go
 * looking in PostHog for events that were never built into the bundle.
 */
export function analyticsStatus(): {
  configured: boolean
  host: string
  /** The library has downloaded and initialised. */
  loaded: boolean
  optedOut: boolean
} {
  return { configured: Boolean(KEY), host: HOST, loaded: client !== null, optedOut: isAnalyticsOptedOut() }
}

export function initAnalytics(): void {
  if (KEY && !KEY.startsWith('phc_') && import.meta.env.DEV) {
    console.warn(
      '[analytics] The PostHog key should start with "phc_" (the public project key). ' +
        'A "phx_" personal key must never be shipped to the browser.',
    )
  }
  if (!KEY) {
    // Silence is the correct behaviour, but not a helpful one to debug.
    if (import.meta.env.DEV) {
      console.info('[analytics] VITE_POSTHOG_KEY is not set — analytics are off.')
    }
    return
  }
  if (started) return
  started = true
  void import('posthog-js').then(({ posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      ui_host: UI_HOST,
      // Everything that could carry someone else's data, off.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      // Only accounts we identify get a person profile; signed-out visitors
      // on the marketing site stay anonymous events.
      person_profiles: 'identified_only',
      respect_dnt: true,
      // PostHog drops events from anything it thinks is a bot, which includes
      // every headless browser — correct in production, and the reason an
      // automated check sees no events. Only a local dev run may turn it off,
      // so real bot traffic can never be counted.
      opt_out_useragent_filter:
        import.meta.env.DEV && import.meta.env.VITE_POSTHOG_ALLOW_BOTS === '1',
      // The native app has no cookie jar worth the name; localStorage is what
      // the WebView keeps.
      persistence: isNative ? 'localStorage' : 'localStorage+cookie',
      // Paths are masked by `maskPath` before we capture, but PostHog derives
      // some URL properties itself — so mask those on the way out too.
      sanitize_properties: (properties) => {
        const next = { ...properties }
        for (const key of ['$current_url', '$pathname', '$referrer', '$initial_current_url']) {
          if (typeof next[key] === 'string') next[key] = maskPath(next[key] as string)
        }
        return next
      },
    })
    posthog.register({ platform: nativePlatform, surface: isNative ? 'app' : 'web' })
    if (isAnalyticsOptedOut()) posthog.opt_out_capturing()
    client = posthog
    for (const fn of queued.splice(0)) fn(posthog)
  })
}

/**
 * Replace record ids in a path with `:id`.
 *
 * A contact id in a URL is a pointer at one real person; it has no analytical
 * value and every privacy cost.
 */
export function maskPath(input: string): string {
  let path = input
  try {
    // Works for a full URL; a bare path throws and is used as-is.
    path = new URL(input).pathname
  } catch {
    // Already a path.
  }
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    // The share/QR links carry an opaque token.
    .replace(/\/add\/[^/]+/, '/add/:token')
}

/** The events this app sends. One list, so they can't drift into free text. */
export type AnalyticsEvent =
  | 'signed_in'
  | 'signed_out'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'contact_created'
  | 'contact_limit_reached'
  | 'upgrade_prompt_shown'
  | 'feature_blocked'
  | 'checkout_started'
  | 'subscription_active'
  | 'school_email_verified'
  /** Sent by hand from Settings, to prove the pipe works end to end. */
  | 'test_event'

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  withClient((ph) => ph.capture(event, properties))
}

/** One page view, with the path masked. Called on every route change. */
export function trackPageview(path: string): void {
  withClient((ph) => ph.capture('$pageview', { $current_url: maskPath(path) }))
}

/**
 * Tie events to an account — by id only. `plan` and `platform` travel as
 * person properties so funnels can be split by them without a join.
 */
export function identifyUser(user: User, properties: Record<string, string | boolean>): void {
  withClient((ph) => ph.identify(user.id, properties))
}

/** On sign-out: stop attributing what happens next to the account that left. */
export function resetAnalytics(): void {
  withClient((ph) => ph.reset())
}

// --- Opting out ---------------------------------------------------------------

const OPT_OUT_KEY = 'retrn-analytics-opt-out'

/** Read the stored preference, before PostHog has necessarily started. */
export function isAnalyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  try {
    if (optedOut) localStorage.setItem(OPT_OUT_KEY, '1')
    else localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // Private mode: the PostHog call below still applies for this session.
  }
  withClient((ph) => (optedOut ? ph.opt_out_capturing() : ph.opt_in_capturing()))
}
