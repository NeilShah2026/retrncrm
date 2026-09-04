import { supabase } from '@/lib/supabase'

/**
 * The single client-side door to the model.
 *
 * Everything about the model — the gateway URL, the key, the model id — lives
 * on the server (`api/ai.ts`). The browser only ever posts to `/api/ai` with
 * the current Supabase access token, so nothing secret reaches the bundle.
 *
 * Every caller is expected to degrade: AI here is an accelerator on top of a
 * feature that already works without it, never a dependency. Callers catch,
 * toast, and carry on with the non-AI path — and no AI call ever gates a save.
 */

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AskOptions {
  system?: string
  messages: AiMessage[]
  /** Server caps this; ask for what the feature actually needs. */
  maxTokens?: number
  signal?: AbortSignal
}

/** The deployment has no model configured (or no session) — hide AI affordances. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

/** A call failed for a transient reason. Retrying is reasonable. */
export class AiRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiRequestError'
  }
}

let unavailable = false

/**
 * False once the server has told us AI isn't configured here. Components use
 * this to stop offering a button that can only disappoint — until then it's
 * optimistically true, since probing on mount would cost a request per page.
 */
export function isAiAvailable(): boolean {
  return !unavailable
}

/** Nothing we ask for is a conversation, so a slow answer is a failed answer. */
const TIMEOUT_MS = 50_000

export async function askClaude({
  system,
  messages,
  maxTokens,
  signal,
}: AskOptions): Promise<string> {
  if (unavailable) throw new AiUnavailableError('AI is not available here.')

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AiUnavailableError('Sign in to use AI features.')

  let response: Response
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ system, messages, maxTokens }),
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new AiRequestError('Could not reach the assistant.')
  }

  if (!response.ok) {
    const message = await errorMessage(response)
    // 503 means "not configured"; 404 means the /api route isn't being served
    // at all (plain `vite dev` without the middleware, say). Neither is worth
    // retrying, so stop offering AI for the rest of this session.
    if (response.status === 503 || response.status === 404) {
      unavailable = true
      throw new AiUnavailableError(message)
    }
    throw new AiRequestError(message)
  }

  const payload = (await response.json()) as { text?: string }
  const text = payload.text?.trim()
  if (!text) throw new AiRequestError('The assistant had nothing to say.')
  return text
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // Non-JSON error body (an HTML 404 page, typically).
  }
  return 'The assistant is unavailable right now.'
}

/**
 * Ask for JSON and get it back typed.
 *
 * Models wrap JSON in fences or a sentence of preamble no matter how firmly
 * you ask them not to, so this pulls the first complete object or array out of
 * the reply rather than trusting the whole string to parse.
 */
export async function askClaudeJson<T>(options: AskOptions): Promise<T> {
  const raw = await askClaude(options)
  const json = extractJson(raw)
  if (json === null) throw new AiRequestError('The assistant’s answer was unreadable.')
  try {
    return JSON.parse(json) as T
  } catch {
    throw new AiRequestError('The assistant’s answer was unreadable.')
  }
}

/** The first balanced `{…}` or `[…]` in a string, ignoring braces inside strings. */
export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = (fenced?.[1] ?? text).trim()

  const start = source.search(/[{[]/)
  if (start === -1) return null

  const open = source[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

/** Trim free text to a token budget without cutting mid-word. */
export function truncate(text: string | undefined, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`
}
