import * as React from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  DEFAULT_LAYOUT,
  moveWidget,
  normalizeLayout,
  resizeWidget,
  setWidgetHidden,
  type DashboardLayout,
  type WidgetId,
  type WidgetSize,
} from '@/lib/dashboardLayout'

/**
 * Where the layout is remembered.
 *
 * Two places, on purpose. The account is the truth — you should get your own
 * dashboard on your laptop and on your phone. But reading it from the account
 * means waiting for the session, and a home screen that rearranges itself a
 * beat after it appears feels broken, so this browser keeps a copy to paint
 * from immediately.
 */
const CACHE_PREFIX = 'retrn-dashboard-layout:'

/** How long to sit on changes before writing them to the account. */
const SYNC_DELAY = 800

function readCache(userId: string): unknown {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(userId: string, layout: DashboardLayout) {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(layout))
  } catch {
    // A full or disabled store shouldn't break the page — the account copy is
    // still the one that matters.
  }
}

export interface DashboardLayoutControls {
  layout: DashboardLayout
  /** Only the widgets actually on the page, in order. */
  visible: DashboardLayout
  /** Widgets put away, offered back in the "add a widget" tray. */
  hidden: DashboardLayout
  /** Move a widget, by its index within `visible`. */
  move: (from: number, to: number) => void
  resize: (id: WidgetId, size: WidgetSize) => void
  hide: (id: WidgetId) => void
  show: (id: WidgetId) => void
  reset: () => void
}

export function useDashboardLayout(): DashboardLayoutControls {
  const { user, updateDashboardLayout } = useAuth()
  const userId = user?.id

  const [layout, setLayout] = React.useState<DashboardLayout>(() =>
    DEFAULT_LAYOUT.map((w) => ({ ...w })),
  )

  /** False until the person actually changes something, so simply opening the
   *  dashboard never writes the default layout back over their saved one. */
  const edited = React.useRef(false)

  // Hydrate once per account. Saving refreshes the session, which hands us a
  // new `user` object; re-reading it then would fight whatever is being
  // dragged right now.
  const hydratedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!userId || hydratedFor.current === userId) return
    hydratedFor.current = userId
    edited.current = false
    setLayout(normalizeLayout(user?.user_metadata?.dashboard_layout ?? readCache(userId)))
  }, [userId, user])

  /** The last change the account hasn't been told about yet. */
  const unsynced = React.useRef<DashboardLayout | null>(null)

  // Dragging a widget across the page produces a change per frame; this
  // browser follows every one of them, the account only hears the last.
  React.useEffect(() => {
    if (!edited.current || !userId) return
    writeCache(userId, layout)
    unsynced.current = layout
    const timer = setTimeout(() => {
      unsynced.current = null
      void updateDashboardLayout(layout)
    }, SYNC_DELAY)
    return () => clearTimeout(timer)
  }, [layout, userId, updateDashboardLayout])

  // Navigating away mid-edit shouldn't cost the last change. This cleanup runs
  // after the one above has cancelled its timer.
  const flush = React.useRef<() => void>(() => {})
  flush.current = () => {
    const pending = unsynced.current
    unsynced.current = null
    if (pending) void updateDashboardLayout(pending)
  }
  React.useEffect(() => () => flush.current(), [])

  const update = React.useCallback(
    (fn: (current: DashboardLayout) => DashboardLayout) => {
      edited.current = true
      setLayout((current) => fn(current))
    },
    [],
  )

  const visible = React.useMemo(() => layout.filter((w) => !w.hidden), [layout])
  const hidden = React.useMemo(() => layout.filter((w) => w.hidden), [layout])

  /**
   * Drag hands us positions among the widgets you can see; the stored layout
   * also holds the ones you've put away. Translating here means a hidden
   * widget keeps its place in the order and comes back where you left it.
   */
  const move = React.useCallback(
    (from: number, to: number) => {
      update((current) => {
        const shown = current.filter((w) => !w.hidden)
        if (from < 0 || to < 0 || from >= shown.length || to >= shown.length) {
          return current
        }
        return moveWidget(
          current,
          current.indexOf(shown[from]),
          current.indexOf(shown[to]),
        )
      })
    },
    [update],
  )

  const resize = React.useCallback(
    (id: WidgetId, size: WidgetSize) =>
      update((current) => resizeWidget(current, id, size)),
    [update],
  )

  const hide = React.useCallback(
    (id: WidgetId) => update((current) => setWidgetHidden(current, id, true)),
    [update],
  )

  const show = React.useCallback(
    (id: WidgetId) => update((current) => setWidgetHidden(current, id, false)),
    [update],
  )

  const reset = React.useCallback(
    () => update(() => DEFAULT_LAYOUT.map((w) => ({ ...w }))),
    [update],
  )

  return { layout, visible, hidden, move, resize, hide, show, reset }
}
