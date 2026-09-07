import * as React from 'react'
import { Plus } from 'lucide-react'
import { WidgetFrame } from '@/components/dashboard/WidgetFrame'
import { WIDGETS, type WidgetContext } from '@/components/dashboard/registry'
import type { DashboardLayout, WidgetId, WidgetSize } from '@/lib/dashboardLayout'

interface Props {
  visible: DashboardLayout
  hidden: DashboardLayout
  ctx: WidgetContext
  editing: boolean
  onMove: (from: number, to: number) => void
  onResize: (id: WidgetId, size: WidgetSize) => void
  onHide: (id: WidgetId) => void
  onShow: (id: WidgetId) => void
}

/**
 * How far into a widget the pointer has to travel before it counts as being
 * over it. A widget's outer edge belongs to whatever is currently being shoved
 * aside — swapping the moment two cards touch makes the whole grid twitch —
 * but too deep a margin and the swap feels like it isn't listening.
 */
const HIT_INSET = 0.15

/** Minimum gap between two reorders, so a fast drag can't outrun the layout. */
const MOVE_COOLDOWN_MS = 120

/**
 * The dashboard itself: a twelve-column grid on a laptop, two columns on a
 * phone, and — while it's being arranged — a drop target.
 *
 * Reordering is worked out from real geometry rather than from a single axis,
 * because the widgets are different widths and a row can hold anything from
 * one card to four. Whichever widget the pointer is sitting inside is the one
 * being displaced; the rest slide out of the way and the layout is saved as
 * you go, so there's nothing to confirm.
 */
export function DashboardGrid({
  visible,
  hidden,
  ctx,
  editing,
  onMove,
  onResize,
  onHide,
  onShow,
}: Props) {
  const nodes = React.useRef(new Map<WidgetId, HTMLElement>())
  const [draggingId, setDraggingId] = React.useState<WidgetId | null>(null)
  const lastMoveAt = React.useRef(0)

  // Positions are read from the DOM mid-drag, so the current order has to be
  // readable without re-creating the drag handlers on every reorder.
  const order = React.useRef(visible)
  order.current = visible

  const handleDragMove = React.useCallback(
    (id: WidgetId, x: number, y: number) => {
      const now = performance.now()
      if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return

      const current = order.current
      const from = current.findIndex((w) => w.id === id)
      if (from < 0) return

      for (let i = 0; i < current.length; i++) {
        if (i === from) continue
        const el = nodes.current.get(current[i].id)
        if (!el) continue
        const r = el.getBoundingClientRect()
        const insetX = r.width * HIT_INSET
        const insetY = r.height * HIT_INSET
        if (
          x >= r.left + insetX &&
          x <= r.right - insetX &&
          y >= r.top + insetY &&
          y <= r.bottom - insetY
        ) {
          lastMoveAt.current = now
          onMove(from, i)
          return
        }
      }
    },
    [onMove],
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-5">
        {visible.map((widget, index) => {
          const meta = WIDGETS[widget.id]
          if (!meta) return null
          return (
            <WidgetFrame
              key={widget.id}
              title={meta.title}
              size={widget.size}
              editing={editing}
              dragging={draggingId === widget.id}
              canMoveUp={index > 0}
              canMoveDown={index < visible.length - 1}
              registerNode={(el) => {
                if (el) nodes.current.set(widget.id, el)
                else nodes.current.delete(widget.id)
              }}
              onDragStart={() => setDraggingId(widget.id)}
              onDragMove={(x, y) => handleDragMove(widget.id, x, y)}
              onDragEnd={() => setDraggingId(null)}
              onMove={(direction) => onMove(index, index + direction)}
              onResize={(size) => onResize(widget.id, size)}
              onHide={() => onHide(widget.id)}
            >
              {meta.render(ctx)}
            </WidgetFrame>
          )
        })}
      </div>

      {editing && (
        <div className="mt-5 rounded-xl border border-dashed p-4">
          <h3 className="mb-1 text-sm font-semibold">Add a widget</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Anything you take off your home screen waits here, and comes back
            where you left it.
          </p>

          {hidden.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Everything is already on your dashboard.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {hidden.map((widget) => {
                const meta = WIDGETS[widget.id]
                if (!meta) return null
                const Icon = meta.icon
                return (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => onShow(widget.id)}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent/50"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {meta.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                    <Plus className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
