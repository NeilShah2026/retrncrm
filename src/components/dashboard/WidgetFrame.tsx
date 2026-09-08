import * as React from 'react'
import { motion, useDragControls } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  GripVertical,
  SlidersHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SIZE_CLASS,
  SIZE_LABELS,
  WIDGET_SIZES,
  type WidgetSize,
} from '@/lib/dashboardLayout'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  size: WidgetSize
  editing: boolean
  dragging: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onDragStart: () => void
  /** Viewport coordinates of the pointer, on every frame of a drag. */
  onDragMove: (x: number, y: number) => void
  onDragEnd: () => void
  onMove: (direction: -1 | 1) => void
  onResize: (size: WidgetSize) => void
  onHide: () => void
  registerNode: (el: HTMLElement | null) => void
  children: React.ReactNode
}

/** Framer hands back whichever event kind the platform fired. */
function pointOf(e: MouseEvent | TouchEvent | PointerEvent) {
  if ('clientX' in e) return { x: e.clientX, y: e.clientY }
  const touch = e.touches[0] ?? e.changedTouches[0]
  return touch ? { x: touch.clientX, y: touch.clientY } : null
}

/**
 * One widget's slot on the dashboard, and — while the page is being arranged —
 * the handle you pick it up by.
 *
 * Dragging is driven from the grip alone rather than the whole card, so a
 * scroll gesture that starts on a widget still scrolls the page. The card
 * underneath goes inert while arranging: tapping "Prep" when you meant to grab
 * a widget is the kind of mistake that makes people stop rearranging things.
 */
export function WidgetFrame({
  title,
  size,
  editing,
  dragging,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMove,
  onResize,
  onHide,
  registerNode,
  children,
}: Props) {
  const dragControls = useDragControls()

  return (
    <motion.div
      ref={registerNode}
      // Position only: a width change is a jump between grid columns, and
      // animating that as a scale squashes the card's text on the way.
      layout="position"
      transition={{ type: 'spring', stiffness: 700, damping: 48 }}
      drag={editing}
      dragControls={dragControls}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={0.12}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDrag={(e) => {
        const point = pointOf(e)
        if (point) onDragMove(point.x, point.y)
      }}
      onDragEnd={onDragEnd}
      style={{ zIndex: dragging ? 30 : undefined }}
      className={cn(
        'relative min-w-0',
        SIZE_CLASS[size],
        dragging && 'cursor-grabbing',
      )}
    >
      <div
        className={cn(
          'h-full transition-opacity',
          editing && 'pointer-events-none select-none',
          dragging && 'opacity-90 shadow-xl',
        )}
      >
        {children}
      </div>

      {editing && (
        <>
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed transition-colors',
              dragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-indigo-500/40 bg-indigo-500/[0.04]',
            )}
          />

          <span className="pointer-events-none absolute left-2 top-2 max-w-[55%] truncate rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
            {title}
          </span>

          <div className="absolute right-2 top-2 flex items-center gap-1">
            <button
              type="button"
              // Without this the browser claims the gesture as a scroll before
              // the drag ever starts on a touchscreen.
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                e.preventDefault()
                dragControls.start(e)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  if (canMoveUp) onMove(-1)
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  if (canMoveDown) onMove(1)
                }
              }}
              aria-label={`Move ${title}. Drag, or use the arrow keys.`}
              className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border bg-background/95 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${title} options`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border bg-background/95 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="truncate">{title}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}>
                  <ArrowUp className="mr-2 h-3.5 w-3.5" />
                  Move earlier
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}>
                  <ArrowDown className="mr-2 h-3.5 w-3.5" />
                  Move later
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  Width
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={size}
                  onValueChange={(value) => onResize(value as WidgetSize)}
                >
                  {WIDGET_SIZES.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {SIZE_LABELS[s]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onHide}>
                  <EyeOff className="mr-2 h-3.5 w-3.5" />
                  Remove from home
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </motion.div>
  )
}
