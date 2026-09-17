import { ArrowDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The small vignettes the three feature panes are illustrated with.
 *
 * Each one is a *true* picture of the screen it describes, drawn with the
 * same tokens the real screen uses — not a decorative graphic. A feature tour
 * whose illustrations are invented shapes teaches nothing and quietly
 * promises an app that doesn't exist; one that shows the actual row you are
 * about to see makes the first real screen feel familiar.
 *
 * They are static and non-interactive by design: nothing here is a control,
 * so nothing here takes a tap that does nothing.
 */

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-[12px] bg-bg-elevated p-3 ring-1 ring-inset ring-border/60',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * The tinted ground a vignette sits on.
 *
 * It does two things at once: it gives the illustration depth without a
 * shadow (a background shift and a hairline, per DESIGN.md §3), and it draws
 * a boundary around the picture so it reads as *a screenshot of the app*
 * rather than as live controls on the pane you are looking at.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-bg-sunken p-3 ring-1 ring-inset ring-border/40">
      {children}
    </div>
  )
}

/** One line in, one contact out. */
export function CaptureVignette() {
  return (
    <div className="space-y-2">
      <Frame>
        <p className="text-ios-footnote leading-snug text-text-secondary">
          Priya Nair, PM at Figma, met at the career fair, follow up in a month
        </p>
      </Frame>

      <div className="flex justify-center">
        <ArrowDown className="h-4 w-4 text-muted-foreground/50" aria-hidden />
      </div>

      <Frame className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[13px] font-semibold text-text-secondary">
          PN
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ios-subhead block truncate font-medium">Priya Nair</span>
          <span className="text-ios-caption block truncate text-muted-foreground">
            Product Manager · Figma
          </span>
        </span>
        <span className="text-ios-caption shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
          Career fair
        </span>
      </Frame>
    </div>
  )
}

/** Who is slipping, and who isn't. */
export function ReconnectVignette() {
  const rows = [
    { initials: 'DO', name: 'David Osei', note: 'Last spoke 4 months ago', state: 'overdue' },
    { initials: 'GL', name: 'Grace Liu', note: 'Due in 2 weeks', state: 'due' },
    { initials: 'MC', name: 'Marcus Chen', note: 'Spoke 5 days ago', state: 'ok' },
  ] as const

  return (
    <Frame className="divide-y divide-border/50 p-0">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[12px] font-semibold text-text-secondary">
            {r.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-ios-subhead block truncate font-medium">{r.name}</span>
            <span className="text-ios-caption block truncate text-muted-foreground">{r.note}</span>
          </span>
          <span
            className={cn(
              'text-ios-caption shrink-0 rounded-full px-2 py-0.5',
              r.state === 'overdue' && 'bg-danger-soft text-danger',
              r.state === 'due' && 'bg-warning-soft text-warning',
              r.state === 'ok' && 'text-muted-foreground',
            )}
          >
            {r.state === 'overdue' ? 'Overdue' : r.state === 'due' ? 'Soon' : 'On track'}
          </span>
        </div>
      ))}
    </Frame>
  )
}

/** The board, as a row of stages carrying counts. */
export function PipelineVignette() {
  const stages = [
    { label: 'Researching', n: 5, dot: 'bg-slate-400' },
    { label: 'Applied', n: 6, dot: 'bg-blue-500' },
    { label: 'Interviewing', n: 2, dot: 'bg-amber-500' },
    { label: 'Offer', n: 1, dot: 'bg-emerald-500' },
  ]
  return (
    <Frame className="space-y-2">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-2.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', s.dot)} />
          <span className="text-ios-footnote flex-1 text-text-secondary">{s.label}</span>
          <span className="text-ios-footnote tnum w-4 text-right font-medium text-foreground">
            {s.n}
          </span>
          {/* A proportional bar, so the shape of a real pipeline is legible. */}
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-foreground/[0.07]">
            <span
              className={cn('block h-full rounded-full', s.dot)}
              style={{ width: `${(s.n / 6) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </Frame>
  )
}

/** One line of the setup checklist, ticking as the work behind it finishes. */
export function SetupLine({
  label,
  state,
}: {
  label: React.ReactNode
  state: 'pending' | 'running' | 'done' | 'failed'
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className={cn(
          'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-base',
          state === 'done' && 'bg-success text-white',
          state === 'failed' && 'bg-danger text-white',
          (state === 'pending' || state === 'running') && 'bg-foreground/[0.08]',
        )}
      >
        {state === 'done' && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
        {state === 'failed' && <span className="text-[11px] font-bold leading-none">!</span>}
        {state === 'running' && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary" />
        )}
      </span>
      <span
        className={cn(
          'text-ios-subhead leading-snug transition-colors duration-base',
          state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}
