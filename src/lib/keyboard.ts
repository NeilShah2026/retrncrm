import { isNative } from '@/lib/platform'

/**
 * The on-screen keyboard, as the page sees it.
 *
 * The WebView is never resized for the keyboard (`resize: 'none'` in
 * capacitor.config.ts). Every resize mode the plugin offers changes the
 * frame in one step — `native` does it a full 200ms *after* the keyboard has
 * finished arriving — so the keyboard slid over the content and then the
 * whole layout jumped to catch up. Instead the page is told where the
 * keyboard is going and how long it takes (ios/App/App/AppDelegate.swift),
 * and everything that has to get out of its way animates there on the same
 * clock, via three custom properties on the root:
 *
 *   --kb-height    how much of the bottom of the screen it covers
 *   --kb-duration  UIKit's own duration for this move
 *   --kb-ease      UIKit's keyboard curve
 *
 * plus `html.keyboard-open`. The rules that consume them live in index.css.
 */

export interface KeyboardFrame {
  /** CSS px of the bottom of the screen the keyboard covers; 0 when down. */
  height: number
  /** How long the keyboard takes to get there, in ms. */
  duration: number
}

/** Used only if the native frame event never arrives (an older build). */
const FALLBACK_DURATION = 420

/** Breathing room kept between a focused field and the keyboard's top edge. */
const FIELD_MARGIN = 16

/** A field is never scrolled closer than this to its scroller's top edge,
 *  which on a phone is where the navigation bar sits over the content. */
const TOP_ROOM = 72

let frame: KeyboardFrame = { height: 0, duration: 0 }
const listeners = new Set<() => void>()
let probe: HTMLDivElement | null = null
let followFrame = 0

export function getKeyboardFrame(): KeyboardFrame {
  return frame
}

export function subscribeKeyboard(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Puts the keyboard away, the way dragging a list does in Messages. */
export function dismissKeyboard(): void {
  const active = document.activeElement
  if (isTextEntry(active)) active.blur()
}

/**
 * Touch handlers for a scrolling list that should put the keyboard away when
 * dragged, as UIKit's `keyboardDismissMode = .onDrag` does.
 */
export const dismissKeyboardOnDrag = (() => {
  let startY: number | null = null
  return {
    onTouchStart(e: { touches: ArrayLike<{ clientY: number }> }) {
      startY = frame.height > 0 && e.touches.length === 1 ? e.touches[0].clientY : null
    },
    onTouchMove(e: { touches: ArrayLike<{ clientY: number }> }) {
      if (startY === null) return
      if (Math.abs(e.touches[0].clientY - startY) > 10) {
        startY = null
        dismissKeyboard()
      }
    },
  }
})()

function isTextEntry(node: unknown): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false
  if (node.isContentEditable || node.tagName === 'TEXTAREA') return true
  if (node.tagName !== 'INPUT') return false
  const type = (node as HTMLInputElement).type
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(type)
}

function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === 'auto' || overflowY === 'scroll') return el
  }
  const doc = document.scrollingElement as HTMLElement | null
  return doc && doc.scrollHeight > window.innerHeight ? doc : null
}

/**
 * Where the keyboard's top edge is *right now*, mid-animation. Read off an
 * invisible element whose height transitions on the same curve, so it is
 * exactly in step with every other rule driven by `--kb-height`.
 */
function currentKeyboardHeight(): number {
  return probe ? probe.getBoundingClientRect().height : frame.height
}

/**
 * Keeps the focused field above the keyboard's rising edge, frame by frame,
 * so it is carried up with the keyboard rather than covered and then jumped
 * to afterwards. Does nothing while the field is already clear of it.
 */
function keepClear(field: HTMLElement) {
  const scroller = scrollParent(field)
  if (!scroller) return
  const isDocument = scroller === document.scrollingElement
  const box = isDocument
    ? { top: 0, bottom: window.innerHeight }
    : scroller.getBoundingClientRect()
  const rect = field.getBoundingClientRect()
  const visibleBottom =
    Math.min(box.bottom, window.innerHeight - currentKeyboardHeight()) - FIELD_MARGIN
  const covered = rect.bottom - visibleBottom
  if (covered <= 0.5) return
  // A field taller than the space left keeps its top edge in view instead of
  // being pushed up under the navigation bar.
  const room = Math.max(0, rect.top - (box.top + TOP_ROOM))
  const by = Math.min(covered, room)
  if (by > 0.5) scroller.scrollTop += by
}

/**
 * Runs for the length of one keyboard move: lists anchored to their end
 * (a chat thread) stay pinned there as they shrink or grow, and a focused
 * field is kept clear of the keyboard as it comes up.
 */
function follow(opening: boolean, duration: number, anchored: HTMLElement[]) {
  cancelAnimationFrame(followFrame)
  const field = opening && isTextEntry(document.activeElement) ? document.activeElement : null
  const until = performance.now() + duration + 50

  const step = () => {
    for (const el of anchored) el.scrollTop = el.scrollHeight
    if (field) keepClear(field)

    // The app shell never scrolls as a document. If WebKit nudged it while
    // revealing a field anyway, that nudge is the whole screen jumping.
    const doc = document.scrollingElement
    if (doc && doc.scrollTop !== 0 && doc.scrollHeight <= window.innerHeight + 1) {
      doc.scrollTop = 0
    }

    if (performance.now() < until) followFrame = requestAnimationFrame(step)
  }
  step()
}

function apply(next: KeyboardFrame) {
  if (next.height === frame.height) return
  const opening = next.height > frame.height

  // Measured before the layout starts moving: only a list that is actually
  // sitting at its end should be held there.
  const anchored = Array.from(
    document.querySelectorAll<HTMLElement>('[data-keyboard-anchor="end"]'),
  ).filter((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 24)

  frame = next
  const root = document.documentElement
  // Duration first: a transition takes its timing from the style it ends in,
  // so both must land in the same style change.
  root.style.setProperty('--kb-duration', `${next.duration}ms`)
  root.style.setProperty('--kb-height', `${next.height}px`)
  root.classList.toggle('keyboard-open', next.height > 0)

  follow(opening, next.duration, anchored)
  listeners.forEach((listener) => listener())
}

/** Called once at boot, native only (src/lib/nativeBootstrap.ts). */
export function startKeyboardTracking(): void {
  if (!isNative) return

  probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.className = 'keyboard-probe'
  document.body.appendChild(probe)

  let heardNative = false
  window.addEventListener('retrnkeyboard', (event) => {
    heardNative = true
    const { height, duration } = event as Event & Partial<KeyboardFrame>
    apply({ height: Math.max(0, Number(height) || 0), duration: Math.max(0, Number(duration) || 0) })
  })

  // A build whose native side predates the frame event still gets the
  // plugin's height, on an approximate duration.
  void import('@capacitor/keyboard').then(({ Keyboard }) => {
    void Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      if (!heardNative) apply({ height: keyboardHeight, duration: FALLBACK_DURATION })
    })
    void Keyboard.addListener('keyboardWillHide', () => {
      if (!heardNative) apply({ height: 0, duration: FALLBACK_DURATION })
    })
  })
}
