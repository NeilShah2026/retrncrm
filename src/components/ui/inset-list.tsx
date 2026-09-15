import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The iOS inset-grouped list, as one primitive both the contacts list and the
 * More screen are built from.
 *
 * Two details are what make it read as a system list rather than as a bordered
 * web card, and both were wrong before:
 *
 * 1. The card is outlined with a *ring*, not a border. A border is part of the
 *    box, so with `overflow-hidden` every row's separator ends up butting into
 *    it at the rounded corners and the whole stack looks a pixel out. A ring
 *    is painted outside the padding box and never collides with the rows.
 * 2. A separator is inset on the left so it starts under the *text*, and runs
 *    flush to the right edge. Inset on both sides — which is what padding on
 *    the bordered element gives you — is the thing that reads as "unaligned".
 */
export function InsetGroup({
  title,
  footer,
  className,
  children,
}: {
  /** A quiet uppercase heading above the card, as iOS labels a section. */
  title?: string
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={className}>
      {title && (
        <h2 className="text-ios-footnote px-4 pb-1.5 font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-inset ring-border/70">
        {children}
      </div>
      {footer && (
        <p className="text-ios-footnote px-4 pt-1.5 text-muted-foreground">{footer}</p>
      )}
    </section>
  )
}

/** The glyph well on a row: a filled square, never an outlined box. */
export function InsetRowIcon({
  icon: Icon,
  tone = 'neutral',
}: {
  icon: typeof ChevronRight
  tone?: 'neutral' | 'danger'
}) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-[7px]',
        tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-bg-sunken text-text-secondary',
      )}
    >
      <Icon className="h-[17px] w-[17px]" />
    </span>
  )
}

/**
 * A text field that *is* the row. iOS forms don't stack a label above a
 * boxed input — the placeholder carries the label and the row's own
 * separator does the work the box used to, which is what lets a form fit on
 * a phone screen instead of scrolling for three of them.
 */
export function InsetInputRow({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  autoCapitalize,
  last,
  id,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
  autoComplete?: string
  autoCapitalize?: string
  last?: boolean
  id?: string
}) {
  return (
    <div className="flex w-full items-stretch pl-4">
      <span className={cn('flex min-w-0 flex-1 items-center pr-4', !last && 'hairline-b')}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          className="text-ios-body h-[44px] w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </span>
    </div>
  )
}

/**
 * A row whose value is picked from a list. The native `<select>` is laid over
 * the row at zero opacity so a tap opens iOS's own wheel picker rather than a
 * web dropdown — the row below it is just what that picker looks like at rest.
 */
export function InsetSelectRow<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder = 'Not set',
  last,
}: {
  label: string
  value: T | ''
  onChange: (value: T | '') => void
  options: { value: T; label: string }[]
  placeholder?: string
  last?: boolean
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <div className="relative flex w-full items-stretch pl-4">
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between gap-2 py-3 pr-4',
          !last && 'hairline-b',
        )}
      >
        <span className="text-ios-body shrink-0">{label}</span>
        <span className="text-ios-body flex min-w-0 items-center gap-1 text-muted-foreground">
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/45" />
        </span>
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className="absolute inset-0 h-full w-full opacity-0"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A multi-line row: the same shape, sized for a sentence. */
export function InsetTextareaRow({
  value,
  onChange,
  placeholder,
  last,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  last?: boolean
}) {
  return (
    <div className="flex w-full items-stretch pl-4">
      <span className={cn('flex min-w-0 flex-1 py-2.5 pr-4', !last && 'hairline-b')}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="text-ios-body w-full min-w-0 resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </span>
    </div>
  )
}

interface InsetRowProps {
  /** An icon well, an avatar — anything that sets the separator's inset. */
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned secondary text: a count, a date. */
  detail?: React.ReactNode
  chevron?: boolean
  /** The last row in a group draws no separator. */
  last?: boolean
  destructive?: boolean
  onClick?: () => void
}

/** One row: 44pt minimum, a separator that starts under the title. */
export function InsetRow({
  leading,
  title,
  subtitle,
  detail,
  chevron = true,
  last,
  destructive,
  onClick,
}: InsetRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press-row flex w-full items-stretch gap-3 pl-4 text-left"
    >
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4',
          !last && 'hairline-b',
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'text-ios-body block truncate',
              destructive && 'text-danger',
            )}
          >
            {title}
          </span>
          {subtitle && (
            <span className="text-ios-footnote mt-0.5 block truncate text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        {detail && (
          <span className="text-ios-footnote shrink-0 text-muted-foreground">{detail}</span>
        )}
        {chevron && (
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/45" />
        )}
      </span>
    </button>
  )
}
