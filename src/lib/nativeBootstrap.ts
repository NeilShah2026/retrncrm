import { isNative } from '@/lib/platform'

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
 *
 * `@capacitor/keyboard` is imported dynamically, not at module top: this
 * same bundle also ships the web app, and a static import would pull the
 * plugin's JS into the shared chunk even though `isNative` is false there
 * and it would never run. The `import()` only ever actually fires on native.
 */
export function bootstrapNative(): void {
  if (!isNative) return

  // Lets src/index.css's `html.native` rules (the system font, the glass
  // chrome, disabling pinch- and double-tap-zoom) apply only inside the
  // native shell, never on web/the installed PWA.
  document.documentElement.classList.add('native')

  document.querySelector('meta[name="viewport"]')?.setAttribute('content', NATIVE_VIEWPORT)

  void import('@capacitor/keyboard').then(({ Keyboard }) => {
    // `resize: 'body'` in capacitor.config.ts shrinks the WebView when the
    // keyboard opens, but that alone doesn't guarantee the focused field
    // ends up inside the now-smaller visible area — nothing re-scrolls it
    // there on its own. Nudge whatever's focused into view once the resize
    // happens, covering exactly the fields the task calls out: contact-add
    // forms and the voice-capture sheet's editable transcript.
    void Keyboard.addListener('keyboardWillShow', () => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement)) return
      const isField =
        active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable
      if (!isField) return
      requestAnimationFrame(() => {
        active.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    })
  })
}
