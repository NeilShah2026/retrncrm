import { Keyboard } from '@capacitor/keyboard'
import { isNative } from '@/lib/platform'

/**
 * One-time native-shell setup, called from main.tsx before the app renders.
 * No-ops entirely on web — every line here is either meaningless or actively
 * wrong outside a Capacitor WebView, so it all stays behind the `isNative`
 * gate rather than trying to detect capabilities piecemeal.
 */
export function bootstrapNative(): void {
  if (!isNative) return

  // Lets src/index.css's `html.native` rules (disabling pinch-zoom and
  // double-tap-zoom — see the `touch-action: pan-x pan-y` rule there) apply
  // only inside the native shell, never on web/the installed PWA.
  document.documentElement.classList.add('native')

  // `resize: 'body'` in capacitor.config.ts shrinks the WebView when the
  // keyboard opens, but that alone doesn't guarantee the focused field ends
  // up inside the now-smaller visible area — nothing re-scrolls it there on
  // its own. Nudge whatever's focused into view once the resize happens,
  // covering exactly the fields the task calls out: contact-add forms and
  // the voice-capture sheet's editable transcript.
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
}
