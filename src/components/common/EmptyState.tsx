import type { LucideIcon } from 'lucide-react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyProps {
  icon?: LucideIcon
  /** Names the object: "No contacts yet", "No opportunities match". */
  title: string
  /** One sentence: what this is for, or what to do next. */
  description?: string
  /** The single next action. Two at most; the first is primary. */
  action?: React.ReactNode
  /**
   * `first-run`: the person has never added this object — dashed frame,
   * more air. `zero`: nothing right now — quiet. `no-results`: a search or
   * filter came back empty — compact, announced to screen readers.
   */
  variant?: 'first-run' | 'zero' | 'no-results'
  className?: string
}

/**
 * The one empty state. Names the object and offers the next action — never
 * a decorative illustration, never a skeleton that stays.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'zero',
  className,
}: EmptyProps) {
  const compact = variant === 'no-results'
  return (
    <div
      role={compact ? 'status' : undefined}
      aria-live={compact ? 'polite' : undefined}
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        variant === 'first-run' && 'rounded-lg border border-dashed py-14',
        variant === 'zero' && 'py-12',
        compact && 'py-10',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'mb-3 flex items-center justify-center rounded-md border bg-bg-sunken text-muted-foreground',
            compact ? 'h-8 w-8' : 'h-9 w-9',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}
      <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

interface ErrorProps {
  title?: string
  /** The underlying message, shown small. */
  detail?: string | null
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/** A collection that couldn't load. Says so, and offers one way out. */
export function ErrorState({
  title = 'Couldn’t load this',
  detail,
  onRetry,
  retrying,
  className,
}: ErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border bg-danger-soft text-danger">
        <WifiOff className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Check your connection and try again. Nothing you saved is lost.
      </p>
      {detail && (
        <p className="mt-2 max-w-sm font-mono text-xs text-muted-foreground/80">{detail}</p>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} loading={retrying} className="mt-4">
          {!retrying && <RefreshCw />}
          Try again
        </Button>
      )}
    </div>
  )
}

/** Shown once a skeleton has been up too long. Calm, with a way out. */
export function SlowState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <h3 className="text-sm font-semibold">Still loading your network</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This is taking longer than usual. You can wait, or reload.
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw />
          Reload
        </Button>
      )}
    </div>
  )
}
