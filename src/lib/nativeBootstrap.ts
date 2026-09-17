import { isNative } from '@/lib/platform'
import { startKeyboardTracking } from '@/lib/keyboard'
import { refreshSubscription } from '@/lib/billing/store'

/**
 * The viewport the native shell needs, which is *not* the one the web build
 * needs. `maximum-scale=1, user-scalable=no` is the only thing that actually
 * stops WKWebView from zooming the whole interface in when a text field under
 * 16px takes focus — `touch-action` governs pinch gestures, not that
 * automatic zoom, and with pinch disabled there is then no way back out, so
 * the app stays magnified and clipped for the rest of the session.
 *
 * It is set here rather than in index.html because that file is shared with
 * the web build and the PWA, where pinch-zoom is a real accessibility
 * affordance that must keep working.
 */
const NATIVE_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content'

/**
 * One-time native-shell setup, called from main.tsx before the app renders.
 * No-ops entirely on web — every line here is either meaningless or actively
 * wrong outside a Capacitor WebView, so it all stays behind the `isNative`
 * gate rather than trying to detect capabilities piecemeal.
 */
export function bootstrapNative(): void {
  if (!isNative) return

  // Lets src/index.css's `html.native` rules (the system font, the glass
  // chrome, disabling pinch- and double-tap-zoom) apply only inside the
  // native shell, never on web/the installed PWA.
  document.documentElement.classList.add('native')

  document.querySelector('meta[name="viewport"]')?.setAttribute('content', NATIVE_VIEWPORT)

  // Everything that moves out of the keyboard's way — see src/lib/keyboard.ts.
  startKeyboardTracking()

  // What this Apple ID has paid for, re-read at every launch: a subscription
  // can lapse, renew or be cancelled while the app is closed, and the cached
  // answer is only as good as the last time the store was asked. A no-op
  // until `setBillingProvider()` is called with a real StoreKit adapter —
  // which is also where that call belongs. See src/lib/billing/store.ts.
  void refreshSubscription()
}
