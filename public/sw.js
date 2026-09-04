/*
 * Retrn's service worker.
 *
 * Deliberately conservative: this app's data lives in Supabase behind
 * row-level security and its AI endpoint is a POST to /api, so the only thing
 * worth caching is the shell — the HTML, the hashed build assets, and the
 * icons. Nothing user-specific is ever written to the cache.
 */
const VERSION = 'retrn-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

/** The document served for every in-app URL; also the offline fallback. */
const APP_SHELL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([APP_SHELL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// The page asks for the new worker as soon as someone accepts the update.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

function isAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg'
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never touch writes, the AI endpoint, Supabase, or anything cross-origin:
  // a stale answer there is worse than no answer.
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network first, so a deploy is picked up immediately, with the
  // cached shell as the offline fallback. The SPA router does the rest.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put(APP_SHELL, copy))
          return response
        })
        .catch(() =>
          caches
            .match(APP_SHELL)
            .then((cached) => cached ?? Response.error()),
        ),
    )
    return
  }

  // Build assets are content-hashed, so a hit is always correct — serve it
  // instantly and refresh in the background.
  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
  }
})
