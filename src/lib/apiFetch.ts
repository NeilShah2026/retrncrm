import { CapacitorHttp } from '@capacitor/core'
import { apiUrl } from '@/lib/apiBase'
import { isNative } from '@/lib/platform'

/**
 * POST JSON to one of our `/api/*` routes and get a standard `Response` back.
 *
 * On the web this is a same-origin `fetch`. In the native app it goes through
 * Capacitor's native HTTP stack instead of the WebView's: the WebView is
 * served from `capacitor://localhost`, so a WebView `fetch` to the production
 * domain is cross-origin, and an authorised JSON POST makes WebKit send a CORS
 * preflight first. Any deployment that doesn't answer that preflight — one
 * that predates `api/_lib/cors.ts`, a misrouted OPTIONS, a CDN rule — kills
 * the request before it's sent, and the assistant just says it "couldn't do
 * that". A native request has no origin and no preflight, so it only depends
 * on the endpoint itself working.
 */
export async function postApi(
  path: `/api/${string}`,
  body: unknown,
  { token, signal, timeoutMs = 50_000 }: { token?: string; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  if (!isNative) {
    return fetch(apiUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    })
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const request = CapacitorHttp.request({
    url: apiUrl(path),
    method: 'POST',
    headers,
    data: body,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  })
  // The native call can't be cancelled, but whoever asked can stop waiting.
  const aborted = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
      once: true,
    })
  })
  const res = await Promise.race([request, aborted])

  // JSON replies arrive already parsed; anything else (an HTML error page)
  // arrives as text. Either way, hand callers the Response they expect.
  const text =
    res.data == null ? '' : typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  const status = res.status >= 200 && res.status <= 599 ? res.status : 502
  const noBody = status === 204 || status === 205 || status === 304
  return new Response(noBody ? null : text, {
    status,
    headers: { 'Content-Type': res.headers?.['content-type'] ?? 'application/json' },
  })
}
