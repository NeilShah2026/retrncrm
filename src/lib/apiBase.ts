import { isNative } from '@/lib/platform'

/**
 * The native app has no relative `/api/*` to call — it's not served from
 * retrncrm.com, it's loaded from a bundled `capacitor://localhost` origin
 * with no server behind it. `api/ai.ts` and `api/verify-edu.ts` are Vercel
 * edge functions that only exist at the production domain, so native builds
 * need the absolute URL; web (browser tab or installed PWA) keeps using a
 * relative path exactly as before, so local dev against `vite dev`'s
 * `/api` middleware still works untouched.
 *
 * If you deploy to a different domain, update this — it deliberately isn't
 * read from `VITE_`-prefixed env because those are baked in at build time
 * per-platform and this same bundle ships to both web and iOS.
 */
// The canonical host, deliberately: the apex 308-redirects to www, and a
// CORS preflight that gets a redirect fails outright — the real request is
// then never sent at all.
export const PRODUCTION_ORIGIN = 'https://www.retrncrm.com'

export function apiUrl(path: `/api/${string}`): string {
  return isNative ? `${PRODUCTION_ORIGIN}${path}` : path
}

/**
 * For the rarer case of building a *complete* URL to hand to something
 * outside the app (a calendar client subscribing to an iCal feed, say) — web
 * already had `window.location.origin` for this; native has no meaningful
 * origin of its own, so it needs the same production fallback as `apiUrl`.
 */
export function apiOrigin(): string {
  return isNative ? PRODUCTION_ORIGIN : window.location.origin
}

/**
 * The origin for links that leave the app in an email. Always the canonical
 * production host — except in local development, so those links can be tested
 * against `vite dev`. The Supabase email template recognises the verification
 * link by this exact origin.
 */
export function emailLinkOrigin(): string {
  if (!isNative && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return window.location.origin
  }
  return PRODUCTION_ORIGIN
}
