import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withCors } from './cors.js'

/**
 * Published QR cards: the short link behind `/c/<slug>`, its counters, and
 * the details people send back through it.
 *
 * `api/card.ts` is the Vercel edge entry point; the dev middleware in
 * `vite.config.ts` calls this same function, so `vite dev` and production
 * can't drift apart.
 *
 * Why a server endpoint at all, when a shareable profile already travels
 * inside the link:
 *
 *  1. **Publishing has to be trustworthy.** A card says who someone is. If
 *     the browser could write `shared_cards` directly, anyone could publish a
 *     card under someone else's slug. Every write here happens with the
 *     service role after the caller's bearer token has been checked.
 *  2. **Resolving is anonymous.** The person scanning has no account — by
 *     design, that's the whole point — so there is no RLS identity to read
 *     the row with.
 *  3. **A handoff is written by a stranger.** Someone scanning Neil's card
 *     can send their details back without signing up, which is a write into
 *     Neil's account by someone who isn't Neil. It lands in `card_handoffs`
 *     unclaimed, never straight into his contacts.
 *
 * Everything is a POST with an `action`, including the read: the dev
 * middleware rebuilds the request from the route alone and drops the query
 * string, so a GET with `?slug=` would work in production and silently
 * return nothing locally.
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

const MAX_BODY_BYTES = 8_000

/** Slugs that must never belong to a person, because a route already does. */
const RESERVED_SLUGS = new Set([
  'app', 'add', 'login', 'privacy', 'terms', 'api', 'auth', 'c', 'verify-edu',
  'admin', 'about', 'help', 'support', 'settings', 'new', 'me',
])

/** The profile fields a card carries, and the longest each may be. */
const PROFILE_FIELDS: Record<string, number> = {
  name: 120,
  headline: 160,
  company: 120,
  school: 120,
  gradYear: 10,
  major: 120,
  linkedinUrl: 300,
  twitter: 80,
  website: 300,
  email: 200,
  phone: 40,
}

/** The fields a handoff carries, and the longest each may be. */
const HANDOFF_FIELDS: Record<string, number> = {
  name: 120,
  email: 200,
  phone: 40,
  company: 120,
  headline: 160,
  school: 120,
  note: 500,
  whereWeMet: 160,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', 'public', any, any>

/**
 * What went wrong, as text.
 *
 * supabase-js rejects with a plain `{ code, message, hint }` object rather
 * than an `Error`, so `err.message` has to be read off the object itself —
 * `String(err)` on one of those is `[object Object]`, which matches no
 * pattern and turns "the migration hasn't run" into a 500.
 */
function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** The bearer token's owner, or null if it isn't a live Retrn session. */
async function authenticate(req: Request): Promise<{ id: string } | null> {
  const { supabaseUrl, supabaseAnonKey } = env()
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || !supabaseUrl || !supabaseAnonKey) return null

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id }
}

/** A trimmed string of at most `max` characters, or '' for anything else. */
function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * `Neil Shah` -> `neil-shah`. Accented letters are folded rather than
 * dropped, so `Renée Dubois` stays `renee-dubois` instead of `ren-dubois`.
 */
function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'card'
}

/**
 * The first free slug starting from the name. Collisions are common on a
 * campus — two Neil Shahs is not a strange thing — so it walks a counter
 * before falling back to something random.
 */
async function freeSlug(admin: AdminClient, name: string): Promise<string> {
  const base = slugify(name)
  for (let n = 1; n <= 30; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (RESERVED_SLUGS.has(candidate)) continue
    const { data, error } = await admin
      .from('shared_cards')
      .select('slug')
      .eq('slug', candidate)
      .maybeSingle()
    if (error) throw error
    if (!data) return candidate
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

/** A profile object keeping only known fields, each trimmed to its cap. */
function cleanProfile(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const [key, max] of Object.entries(PROFILE_FIELDS)) {
    const value = str(source[key], max)
    if (value) out[key] = value
  }
  return out.name ? out : null
}

export async function handleCardRequest(req: Request): Promise<Response> {
  return withCors(handle)(req)
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const { supabaseUrl, serviceRoleKey } = env()
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Sharing is not configured on this deployment.' }, 503)
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large.' }, 413)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  const admin: AdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const action = str(body.action, 20)

  try {
    switch (action) {
      case 'resolve':
        return await resolve(admin, body)
      case 'saved':
        return await saved(admin, body)
      case 'handoff':
        return await handoff(admin, body)
      case 'publish':
        return await publish(admin, req, body)
      case 'mine':
        return await mine(admin, req)
      case 'claim':
        return await claim(admin, req, body)
      default:
        return json({ error: 'Unknown action.' }, 400)
    }
  } catch (err) {
    // A missing table means migration 0009 hasn't run. That is a deployment
    // state, not a bug in the caller, and the client is built to fall back to
    // the self-contained link — so say so plainly rather than 500ing.
    if (/relation .* does not exist|schema cache/i.test(messageOf(err))) {
      return json({ error: 'not-set-up' }, 503)
    }
    console.error('[api/card]', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
}

// --- Public: anyone holding the link -------------------------------------

/** The profile behind a short link. Counts the scan on the way past. */
async function resolve(admin: AdminClient, body: Record<string, unknown>): Promise<Response> {
  const slug = str(body.slug, 60).toLowerCase()
  if (!slug) return json({ error: 'Missing slug.' }, 400)

  const { data, error } = await admin
    .from('shared_cards')
    .select('slug, profile')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return json({ error: 'not-found' }, 404)

  // A reload by the same person shouldn't really count, but the alternative
  // is keeping something that identifies a visitor. A slightly generous
  // number is the better trade here.
  if (body.count === true) {
    await admin.rpc('bump_card_counter', { card_slug: slug, which: 'scan' })
  }
  return json({ slug: data.slug, profile: data.profile }, 200)
}

/** "Someone saved my card" — the one number that says the QR is working. */
async function saved(admin: AdminClient, body: Record<string, unknown>): Promise<Response> {
  const slug = str(body.slug, 60).toLowerCase()
  if (!slug) return json({ error: 'Missing slug.' }, 400)
  await admin.rpc('bump_card_counter', { card_slug: slug, which: 'save' })
  return json({ ok: true }, 200)
}

/** Details sent back by the person who scanned. Waits to be accepted. */
async function handoff(admin: AdminClient, body: Record<string, unknown>): Promise<Response> {
  const slug = str(body.slug, 60).toLowerCase()
  const name = str(body.name, HANDOFF_FIELDS.name)
  if (!slug || !name) return json({ error: 'A name is needed.' }, 400)

  const { data: card, error: cardError } = await admin
    .from('shared_cards')
    .select('slug, user_id')
    .eq('slug', slug)
    .maybeSingle()
  if (cardError) throw cardError
  if (!card) return json({ error: 'not-found' }, 404)

  // One person can't bury someone's QR screen under hundreds of these.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('card_handoffs')
    .select('id', { count: 'exact', head: true })
    .eq('card_slug', slug)
    .is('claimed_at', null)
    .gte('created_at', since)
  if (countError) throw countError
  if ((count ?? 0) >= 40) return json({ error: 'rate-limited' }, 429)

  const metOn = str(body.metOn, 10)
  const { error } = await admin.from('card_handoffs').insert({
    card_slug: slug,
    user_id: card.user_id,
    name,
    email: str(body.email, HANDOFF_FIELDS.email) || null,
    phone: str(body.phone, HANDOFF_FIELDS.phone) || null,
    company: str(body.company, HANDOFF_FIELDS.company) || null,
    headline: str(body.headline, HANDOFF_FIELDS.headline) || null,
    school: str(body.school, HANDOFF_FIELDS.school) || null,
    note: str(body.note, HANDOFF_FIELDS.note) || null,
    where_we_met: str(body.whereWeMet, HANDOFF_FIELDS.whereWeMet) || null,
    met_on: /^\d{4}-\d{2}-\d{2}$/.test(metOn) ? metOn : null,
  })
  if (error) throw error
  return json({ ok: true }, 200)
}

// --- Signed in: the card's owner ------------------------------------------

/**
 * Publish (or refresh) the caller's card. An account keeps the slug it was
 * first given for good: the point of a short link is that it can be printed
 * on a name badge, and a link that changes when you edit your headline is
 * worse than no link at all.
 */
async function publish(
  admin: AdminClient,
  req: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const caller = await authenticate(req)
  if (!caller) return json({ error: 'Not signed in.' }, 401)

  const profile = cleanProfile(body.profile)
  if (!profile) return json({ error: 'A name is needed to publish a card.' }, 400)

  const { data: existing, error: readError } = await admin
    .from('shared_cards')
    .select('slug')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (readError) throw readError

  const slug = existing?.slug ?? (await freeSlug(admin, profile.name))
  const { error } = await admin
    .from('shared_cards')
    .upsert({ slug, user_id: caller.id, profile }, { onConflict: 'user_id' })
  if (error) throw error

  return json({ slug }, 200)
}

/** The caller's own card, its counters, and anything waiting to be accepted. */
async function mine(admin: AdminClient, req: Request): Promise<Response> {
  const caller = await authenticate(req)
  if (!caller) return json({ error: 'Not signed in.' }, 401)

  const { data: card, error } = await admin
    .from('shared_cards')
    .select('slug, scan_count, save_count')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (error) throw error

  const { data: handoffs, error: handoffError } = await admin
    .from('card_handoffs')
    .select('id, name, email, phone, company, headline, school, note, where_we_met, met_on, created_at')
    .eq('user_id', caller.id)
    .is('claimed_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (handoffError) throw handoffError

  return json(
    {
      card: card
        ? { slug: card.slug, scanCount: card.scan_count, saveCount: card.save_count }
        : null,
      handoffs: (handoffs ?? []).map((h) => ({
        id: h.id as string,
        name: h.name as string,
        email: (h.email as string | null) ?? undefined,
        phone: (h.phone as string | null) ?? undefined,
        company: (h.company as string | null) ?? undefined,
        headline: (h.headline as string | null) ?? undefined,
        school: (h.school as string | null) ?? undefined,
        note: (h.note as string | null) ?? undefined,
        whereWeMet: (h.where_we_met as string | null) ?? undefined,
        metOn: (h.met_on as string | null) ?? undefined,
        createdAt: h.created_at as string,
      })),
    },
    200,
  )
}

/** Mark handoffs as dealt with, once the client has made contacts of them. */
async function claim(
  admin: AdminClient,
  req: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const caller = await authenticate(req)
  if (!caller) return json({ error: 'Not signed in.' }, 401)

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 50)
    : []
  if (ids.length === 0) return json({ ok: true }, 200)

  // Scoped to the caller as well as the ids: a stolen id from someone else's
  // account must not be resolvable from here.
  const { error } = await admin
    .from('card_handoffs')
    .update({ claimed_at: new Date().toISOString() })
    .eq('user_id', caller.id)
    .in('id', ids)
  if (error) throw error
  return json({ ok: true }, 200)
}
