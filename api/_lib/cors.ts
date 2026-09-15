/**
 * Cross-origin access for the native app.
 *
 * The web app calls these functions with a relative `/api/…` path, so it is
 * same-origin and CORS never enters into it. The iOS app is a different
 * story: its WebView is served from `capacitor://localhost`, so every call to
 * the production domain is cross-origin and the browser sends a preflight
 * first. Without an `OPTIONS` answer carrying `Access-Control-Allow-*`, that
 * preflight fails and the real request is never sent — which reads, in the
 * app, as "the AI stopped working and fell back to keyword search".
 *
 * Only the native shells' own origins are listed. These endpoints authorise
 * with a bearer token rather than cookies, so no credentials are involved.
 */
const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost', // iOS
  'ionic://localhost', // iOS, legacy scheme
  'http://localhost', // Android
])

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  if (!ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    // The answer differs per origin, so it must not be cached as if it didn't.
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Wraps a handler so it answers preflights and tags every reply with the CORS
 * headers. A same-origin caller gets no extra headers and is unaffected.
 */
export function withCors(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const cors = corsHeaders(req)
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    const response = await handler(req)
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value)
    }
    return response
  }
}
