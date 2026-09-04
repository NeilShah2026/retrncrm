import { createClient } from '@supabase/supabase-js'

/**
 * The one implementation of the AI proxy. `api/ai.ts` is the Vercel edge
 * entry point; the dev-only middleware in `vite.config.ts` calls the same
 * function, so `vite dev` and production can't drift apart.
 *
 * Everything about the model lives here rather than in the bundle: the
 * gateway key is a server-only env var and must never be reachable from the
 * browser. That makes this endpoint a relay, so it authenticates the caller
 * with their Supabase access token before spending anything — a Retrn
 * session is the only thing that can use our model budget.
 *
 * Files under `api/_lib/` are ignored by Vercel's function router (leading
 * underscore), so this ships as a module, not a second endpoint.
 */

/**
 * Read per-request rather than at import time: the Vite dev plugin loads `.env`
 * into `process.env` after this module has already been imported.
 */
function env() {
  return {
    gatewayUrl: process.env.AI_GATEWAY_URL ?? '',
    gatewayKey: process.env.AI_GATEWAY_KEY ?? '',
    model: process.env.AI_MODEL ?? 'claude-sonnet-46',
    supabaseUrl: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    supabaseAnonKey:
      process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
  }
}

/** Nothing we ask for needs a long answer; this is the hard ceiling. */
const MAX_TOKENS_CAP = 1500
const DEFAULT_MAX_TOKENS = 700
/** A roster of a few hundred contacts is ~40KB; past this something is wrong. */
const MAX_BODY_BYTES = 120_000
/** The gateway is fast, but a hung upstream must not hold the function open. */
const TIMEOUT_MS = 45_000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AiRequestBody {
  system?: unknown
  messages?: unknown
  maxTokens?: unknown
}

interface GatewayResponse {
  content?: { type: string; text?: string }[]
  stop_reason?: string | null
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string' &&
    m.content.trim().length > 0
  )
}

/** The bearer token's owner, or null if it isn't a live Retrn session. */
async function authenticate(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<string | null> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function handleAiRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  const { gatewayUrl, gatewayKey, model, supabaseUrl, supabaseAnonKey } = env()

  if (!gatewayUrl || !gatewayKey) {
    // Every caller treats this as "AI is off" and falls back to its non-AI path.
    return json({ error: 'AI is not configured on this deployment.' }, 503)
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'AI cannot verify sign-in on this deployment.' }, 503)
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'That request is too large.' }, 413)
  }

  const userId = await authenticate(req, supabaseUrl, supabaseAnonKey)
  if (!userId) {
    return json({ error: 'Sign in to use AI features.' }, 401)
  }

  let body: AiRequestBody
  try {
    body = JSON.parse(raw) as AiRequestBody
  } catch {
    return json({ error: 'Malformed request body.' }, 400)
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(isChatMessage)
    : []
  if (messages.length === 0) {
    return json({ error: 'No prompt provided.' }, 400)
  }

  const requested =
    typeof body.maxTokens === 'number' && Number.isFinite(body.maxTokens)
      ? Math.floor(body.maxTokens)
      : DEFAULT_MAX_TOKENS
  const maxTokens = Math.min(Math.max(requested, 64), MAX_TOKENS_CAP)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const upstream = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': gatewayKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(typeof body.system === 'string' && body.system.trim()
          ? { system: body.system }
          : {}),
        messages,
      }),
      signal: controller.signal,
    })

    if (!upstream.ok) {
      // Upstream error text can carry key/account detail — log it, don't relay it.
      console.error('AI gateway error', upstream.status, await upstream.text())
      return json({ error: 'The model is unavailable right now.' }, 502)
    }

    const data = (await upstream.json()) as GatewayResponse
    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim()

    if (!text) return json({ error: 'The model returned nothing usable.' }, 502)

    return json({ text, stopReason: data.stop_reason ?? null }, 200)
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    console.error('AI gateway request failed', err)
    return json(
      { error: timedOut ? 'That took too long — try again.' : 'Could not reach the model.' },
      timedOut ? 504 : 502,
    )
  } finally {
    clearTimeout(timer)
  }
}
