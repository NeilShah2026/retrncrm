import * as React from 'react'
import { isNative } from '@/lib/platform'

/**
 * True while the on-screen keyboard is up.
 *
 * `resize: 'body'` (capacitor.config.ts) already shrinks the WebView when the
 * keyboard opens, so anything anchored to the bottom lands above it on its
 * own. What that can't tell you is whether to still be *showing* — the tab
 * bar gets out of the way while someone is typing, the way it does in
 * Messages, instead of stacking on top of the composer.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isNative) return
    let cancelled = false
    let remove: (() => void) | undefined

    void import('@capacitor/keyboard').then(async ({ Keyboard }) => {
      const [shown, hidden] = await Promise.all([
        Keyboard.addListener('keyboardWillShow', () => setOpen(true)),
        Keyboard.addListener('keyboardWillHide', () => setOpen(false)),
      ])
      if (cancelled) {
        shown.remove()
        hidden.remove()
        return
      }
      remove = () => {
        shown.remove()
        hidden.remove()
      }
    })

    return () => {
      cancelled = true
      remove?.()
    }
  }, [])

  /*
   * Focus is the second, race-free signal. A sheet that puts the caret in a
   * field as it mounts raises the keyboard before the plugin listener above
   * has finished subscribing, so the `willShow` event is missed entirely and
   * the layout never compacts. Focus lands on the element either way.
   */
  React.useEffect(() => {
    if (!isNative) return

    const isTextEntry = (node: EventTarget | null) =>
      node instanceof HTMLElement &&
      (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)

    // A field autofocused during the same commit that mounted this hook has
    // already fired its event by now, so start from what is focused rather
    // than waiting for the next change.
    if (isTextEntry(document.activeElement)) setOpen(true)

    const onFocusIn = (e: FocusEvent) => {
      if (isTextEntry(e.target)) setOpen(true)
    }
    // Moving between two fields keeps the keyboard up, so settle first and
    // then ask what actually has focus.
    const onFocusOut = () => {
      setTimeout(() => {
        if (!isTextEntry(document.activeElement)) setOpen(false)
      }, 0)
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return open
}
