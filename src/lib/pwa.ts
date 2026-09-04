import { toast } from 'sonner'

/**
 * Registers the service worker that makes the app installable and lets it
 * open offline.
 *
 * The one thing a cached shell must not do is trap someone on an old build,
 * so when a new worker is waiting we say so and let them take it — rather
 * than reloading under them mid-sentence, or leaving them stale in silence.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Dev is served by Vite with its own module graph; a worker in front of it
  // only ever serves stale code.
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting) promptUpdate(registration.waiting)

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // "installed" with a controller already present means this is an
            // update, not the very first install.
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(installing)
            }
          })
        })
      })
      .catch(() => {
        // An unavailable worker costs offline support and nothing else.
      })
  })

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

function promptUpdate(worker: ServiceWorker) {
  toast('A new version of Retrn is ready.', {
    duration: Infinity,
    action: {
      label: 'Reload',
      onClick: () => worker.postMessage('skip-waiting'),
    },
  })
}
