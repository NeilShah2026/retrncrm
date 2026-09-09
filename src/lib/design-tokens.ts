/**
 * Design tokens for code that can't read CSS variables — motion timings for
 * JS-driven animation, numeric radii for canvases/QR frames, and the names
 * of the few places the brand accent is allowed to appear.
 *
 * The CSS in `src/index.css` is the source of truth; keep these in sync.
 */

export const MOTION = {
  /** Hover/press feedback, opacity fades. */
  fast: 120,
  /** Opens, closes, layout shifts. */
  base: 160,
  /** Larger surfaces: sheets, page-level transitions. */
  slow: 220,
  easeOut: [0.2, 0, 0, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
} as const

export const RADIUS = {
  control: 6,
  card: 8,
  modal: 10,
} as const

/** Row heights for dense list surfaces (contacts table, ⌘K, pipeline). */
export const DENSITY = {
  row: 36,
  rowCompact: 32,
  toolbar: 36,
} as const

/**
 * Where `text-brand` / `bg-brand` may be used. Anything not on this list is
 * a neutral. Kept as a list so a review can grep for it.
 */
export const BRAND_ALLOWED = [
  'focus ring',
  'selected navigation item',
  'inline link',
  '"Suggested" badge on model output',
  'calendar today marker',
  'text selection',
] as const

/** How long a skeleton may show before the gate asks the user to retry. */
export const LOADING_TIMEOUT_MS = 2000
