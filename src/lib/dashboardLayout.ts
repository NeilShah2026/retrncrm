/**
 * The shape of a personalised dashboard.
 *
 * The home screen is a list of widgets: an order, a width for each, and a flag
 * for the ones you've put away. Everything here is plain data so it can be
 * stored on the account (and cached in this browser) and read back on any
 * device — the catalog that turns an id into an actual card lives next to the
 * components, in `components/dashboard/registry.tsx`.
 */

export type WidgetId =
  | 'stat-contacts'
  | 'stat-meetings'
  | 'stat-overdue'
  | 'stat-pipeline'
  | 'stat-added-this-month'
  | 'stat-strong-ties'
  | 'briefing'
  | 'upcoming-meetings'
  | 'needs-attention'
  | 'recently-added'
  | 'pipeline-snapshot'
  | 'quick-actions'
  | 'top-tags'
  | 'network-mix'

/**
 * Widths, named for what they look like rather than for a column count: the
 * desktop grid is twelve columns wide, a phone is two.
 */
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export const WIDGET_SIZES: WidgetSize[] = ['sm', 'md', 'lg', 'xl', 'full']

export const SIZE_LABELS: Record<WidgetSize, string> = {
  sm: 'Quarter',
  md: 'Third',
  lg: 'Half',
  xl: 'Two thirds',
  full: 'Full width',
}

/**
 * Tailwind spans, written out in full because the compiler only sees class
 * names it can read literally in the source.
 */
export const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: 'col-span-1 lg:col-span-3',
  md: 'col-span-2 lg:col-span-4',
  lg: 'col-span-2 lg:col-span-6',
  xl: 'col-span-2 lg:col-span-8',
  full: 'col-span-2 lg:col-span-12',
}

export interface WidgetLayout {
  id: WidgetId
  size: WidgetSize
  /** Put away rather than deleted — its place in the order is remembered. */
  hidden?: boolean
}

export type DashboardLayout = WidgetLayout[]

/**
 * The dashboard everyone starts with — the same page the app shipped with,
 * plus the extras parked in the "add a widget" tray so nobody has to lose
 * anything to discover them.
 */
export const DEFAULT_LAYOUT: DashboardLayout = [
  { id: 'stat-contacts', size: 'sm' },
  { id: 'stat-meetings', size: 'sm' },
  { id: 'stat-overdue', size: 'sm' },
  { id: 'stat-pipeline', size: 'sm' },
  { id: 'briefing', size: 'xl' },
  { id: 'upcoming-meetings', size: 'md' },
  { id: 'needs-attention', size: 'xl' },
  { id: 'recently-added', size: 'md' },
  { id: 'pipeline-snapshot', size: 'full' },
  { id: 'quick-actions', size: 'md', hidden: true },
  { id: 'top-tags', size: 'md', hidden: true },
  { id: 'network-mix', size: 'md', hidden: true },
  { id: 'stat-added-this-month', size: 'sm', hidden: true },
  { id: 'stat-strong-ties', size: 'sm', hidden: true },
]

const VALID_IDS = new Set<string>(DEFAULT_LAYOUT.map((w) => w.id))
const VALID_SIZES = new Set<string>(WIDGET_SIZES)

/**
 * Turn whatever came back from storage into a layout we can render.
 *
 * Saved layouts outlive the code that wrote them: a widget can be retired, and
 * a new one can ship after someone last touched their dashboard. So unknown
 * ids are dropped, and anything in the catalog the stored layout has never
 * heard of is appended in its default state — a new widget arrives in the tray
 * rather than rearranging a page somebody already laid out.
 */
export function normalizeLayout(stored: unknown): DashboardLayout {
  if (!Array.isArray(stored)) return DEFAULT_LAYOUT.map((w) => ({ ...w }))

  const seen = new Set<WidgetId>()
  const layout: DashboardLayout = []

  for (const entry of stored) {
    if (!entry || typeof entry !== 'object') continue
    const { id, size, hidden } = entry as Partial<WidgetLayout>
    if (typeof id !== 'string' || !VALID_IDS.has(id) || seen.has(id as WidgetId)) {
      continue
    }
    seen.add(id as WidgetId)
    layout.push({
      id: id as WidgetId,
      size: typeof size === 'string' && VALID_SIZES.has(size)
        ? (size as WidgetSize)
        : (DEFAULT_LAYOUT.find((w) => w.id === id)?.size ?? 'md'),
      hidden: hidden === true,
    })
  }

  for (const fallback of DEFAULT_LAYOUT) {
    if (!seen.has(fallback.id)) layout.push({ ...fallback })
  }

  return layout
}

/** True when the layout is untouched — used to hide a pointless "reset". */
export function isDefaultLayout(layout: DashboardLayout): boolean {
  if (layout.length !== DEFAULT_LAYOUT.length) return false
  return layout.every((w, i) => {
    const d = DEFAULT_LAYOUT[i]
    return w.id === d.id && w.size === d.size && Boolean(w.hidden) === Boolean(d.hidden)
  })
}

// ---------------------------------------------------------------------------
// Operations. All pure — they return a new layout, never mutate.
// ---------------------------------------------------------------------------

export function moveWidget(
  layout: DashboardLayout,
  from: number,
  to: number,
): DashboardLayout {
  if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) {
    return layout
  }
  const next = [...layout]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function resizeWidget(
  layout: DashboardLayout,
  id: WidgetId,
  size: WidgetSize,
): DashboardLayout {
  return layout.map((w) => (w.id === id ? { ...w, size } : w))
}

export function setWidgetHidden(
  layout: DashboardLayout,
  id: WidgetId,
  hidden: boolean,
): DashboardLayout {
  return layout.map((w) => (w.id === id ? { ...w, hidden } : w))
}
