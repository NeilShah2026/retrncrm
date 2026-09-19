import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from '@/lib/pwa'
import { bootstrapNative } from '@/lib/nativeBootstrap'
import { isNative } from '@/lib/platform'
import { initAnalytics } from '@/lib/analytics'

bootstrapNative()
// Product analytics. Does nothing at all without VITE_POSTHOG_KEY, and
// nothing for anyone who has switched it off in Settings.
initAnalytics()
// The service worker is a web/PWA-only concept — installing one inside the
// native shell would just cache a copy of the app the native shell itself
// already owns, for no benefit.
if (!isNative) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
