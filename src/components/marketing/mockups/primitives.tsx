import { cn } from '@/lib/utils'
import { avatarColor } from '@/lib/format'

/**
 * Building blocks for the live marketing mockups. They use the app's own
 * tokens — hairlines, muted avatars, real tag tints — so the mockups are
 * slices of the product, not renderings of it. Every mockup is labelled
 * "Example data" by its caller.
 */

export function MockAvatar({
  name,
  size = 24,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full font-medium',
        avatarColor(name),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

const TAG_TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
}

export function MockTag({ children, tone = 'slate' }: { children: React.ReactNode; tone?: keyof typeof TAG_TONES }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-1.5 text-[11px] font-medium leading-none', TAG_TONES[tone])}>
      {children}
    </span>
  )
}

/** The surface every mockup sits on: a panel, exactly as in the app. */
export function MockSurface({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card text-left text-foreground', className)} aria-hidden>
      {children}
    </div>
  )
}

/** A panel header inside a mockup. */
export function MockHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between border-b px-3 text-xs font-semibold">
      {children}
      {action && <span className="text-[11px] font-normal text-muted-foreground">{action}</span>}
    </div>
  )
}
