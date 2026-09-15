import * as React from 'react'
import { getKeyboardFrame, subscribeKeyboard } from '@/lib/keyboard'

/**
 * True while the on-screen keyboard is up (native only; always false on web).
 *
 * For *what* to show while typing, not for moving things out of the way:
 * a React render lands a frame or two after the keyboard starts moving, so
 * anything that has to travel with it is driven from CSS instead
 * (`html.keyboard-open`, `--kb-height` — see src/lib/keyboard.ts).
 */
export function useKeyboardOpen(): boolean {
  return React.useSyncExternalStore(
    subscribeKeyboard,
    () => getKeyboardFrame().height > 0,
    () => false,
  )
}
