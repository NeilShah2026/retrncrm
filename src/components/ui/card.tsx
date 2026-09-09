import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A panel: hairline border, 8px radius, no shadow. Elevation in this app is
 * a border and a background shift; drop shadows are for floating layers
 * only (popovers, menus, dialogs).
 *
 * `Panel` is the name to reach for in new code. `Card` is the same component
 * under shadcn's name so existing imports keep working. Never nest one
 * inside another — use a `PanelSection` (hairline-separated) instead.
 */
const Panel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground', className)}
      {...props}
    />
  ),
)
Panel.displayName = 'Panel'

/** Title row of a panel: 16px section type, optional trailing action. */
const PanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }
>(({ className, children, action, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2.5',
      className,
    )}
    {...props}
  >
    <div className="min-w-0 text-sm font-semibold">{children}</div>
    {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
  </div>
))
PanelHeader.displayName = 'PanelHeader'

/** Hairline-separated block inside a panel. */
const PanelSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border-b px-4 py-3 last:border-b-0', className)}
      {...props}
    />
  ),
)
PanelSection.displayName = 'PanelSection'

// ---- shadcn-compatible aliases -------------------------------------------

const Card = Panel

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 p-4', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm font-semibold leading-none', className)} {...props} />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-4 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export {
  Panel,
  PanelHeader,
  PanelSection,
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
