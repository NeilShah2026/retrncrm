import * as React from 'react'
import { Check, ChevronRight, CircleX } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { selectionFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/**
 * The iOS inset-grouped list, as one set of primitives the phone's forms,
 * sheets, the contacts list and the More and Settings screens are built from.
 *
 * Details that make it read as a system list rather than as a web card:
 *
 * 1. On a grouped (grey) ground the cells carry no outline at all, as in
 *    Settings. Only a list sitting on a plain page (`outlined`) gets one, and
 *    that is a *ring*, not a border: a border is part of the box, so with
 *    `overflow-hidden` every separator butts into it at the rounded corners.
 * 2. A separator is inset on the left so it starts under the *text*, and runs
 *    flush to the right edge.
 * 3. Every row is at least 44pt, with 16pt of side padding.
 */
export function InsetGroup({
  title,
  footer,
  outlined,
  className,
  children,
}: {
  /** A quiet uppercase heading above the card, as iOS labels a section. */
  title?: string
  footer?: React.ReactNode
  /** For a list on a plain background rather than a grouped one. */
  outlined?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={className}>
      {title && (
        <h2 className="text-ios-footnote px-4 pb-1.5 uppercase tracking-[0.02em] text-muted-foreground">
          {title}
        </h2>
      )}
      <div
        className={cn(
          'overflow-hidden rounded-[12px] bg-grouped-cell',
          outlined && 'ring-1 ring-inset ring-border/70',
        )}
      >
        {children}
      </div>
      {footer && (
        <div className="text-ios-footnote px-4 pt-1.5 text-muted-foreground">{footer}</div>
      )}
    </section>
  )
}

/**
 * The glyph tile at the start of a Settings row: a filled rounded square with
 * a white glyph. Neutral grey rather than a rainbow of hues — the design
 * system keeps colour for meaning — except for a destructive row.
 */
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
        'flex h-[29px] w-[29px] items-center justify-center rounded-[7px] text-white',
        tone === 'danger' ? 'bg-danger' : 'bg-text-muted',
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
    </span>
  )
}

/** The part of a row right of its leading slot: where the separator lives. */
function RowBody({
  last,
  className,
  children,
}: {
  last?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn('flex min-h-[44px] min-w-0 flex-1 items-center gap-2 pr-4', !last && 'hairline-b', className)}
    >
      {children}
    </span>
  )
}

/**
 * A text field that *is* the row. With no `label`, the placeholder carries
 * the label, as iOS Contacts takes a new card; with one, the label sits at
 * the start and the value fills the rest, as in a Settings form.
 */
export const InsetInputRow = React.forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (value: string) => void
    placeholder: string
    label?: string
    type?: string
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
    enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint']
    autoComplete?: string
    autoCapitalize?: string
    last?: boolean
    id?: string
    onEnter?: () => void
  }
>(
  (
    {
      value,
      onChange,
      placeholder,
      label,
      type = 'text',
      inputMode,
      enterKeyHint,
      autoComplete,
      autoCapitalize,
      last,
      id,
      onEnter,
    },
    ref,
  ) => (
    <label className="flex w-full items-stretch pl-4">
      <RowBody last={last}>
        {label && <span className="text-ios-body w-[6.5rem] shrink-0 truncate">{label}</span>}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={
            onEnter
              ? (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onEnter()
                  }
                }
              : undefined
          }
          placeholder={placeholder}
          aria-label={label ?? placeholder}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoComplete={autoComplete ?? 'off'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect="off"
          spellCheck={false}
          className="text-ios-body h-[44px] w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </RowBody>
    </label>
  ),
)
InsetInputRow.displayName = 'InsetInputRow'

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
  allowNone = true,
  last,
}: {
  label: string
  value: T | ''
  onChange: (value: T | '') => void
  options: { value: T; label: string }[]
  placeholder?: string
  /** false when the field always has a value (no "Not set" entry). */
  allowNone?: boolean
  last?: boolean
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <div className="press-row relative flex w-full items-stretch pl-4">
      <RowBody last={last} className="justify-between">
        <span className="text-ios-body shrink-0">{label}</span>
        <span className="text-ios-body flex min-w-0 items-center gap-1 text-muted-foreground">
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/45" />
        </span>
      </RowBody>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          selectionFeedback()
          onChange(e.target.value as T | '')
        }}
        className="absolute inset-0 h-full w-full opacity-0"
      >
        {allowNone && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * A date as a row. The real `<input type="date">` lies invisibly over it, so
 * a tap opens iOS's own date picker rather than a web date field.
 */
export function InsetDateRow({
  label,
  value,
  onChange,
  placeholder = 'Not set',
  last,
}: {
  label: string
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  last?: boolean
}) {
  return (
    <div className="relative flex w-full items-stretch pl-4">
      <RowBody last={last} className="justify-between pr-3">
        <span className="text-ios-body shrink-0">{label}</span>
        <span
          className={cn(
            'text-ios-body truncate',
            value ? 'text-foreground' : 'text-muted-foreground',
            // Leaves the clear button's slot free of the invisible input.
            value && 'pr-9',
          )}
        >
          {value ? formatDate(value) : placeholder}
        </span>
      </RowBody>
      <input
        type="date"
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn('absolute inset-y-0 left-0 h-full opacity-0', value ? 'right-11' : 'right-0')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground/70"
        >
          <CircleX className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  )
}

/**
 * A time as a row, the same trick as the date row: iOS's own wheel opens
 * over it. `value` is 24-hour `HH:mm`; the row shows it the way the phone
 * writes time.
 */
export function InsetTimeRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  last?: boolean
}) {
  const [h, m] = value.split(':').map(Number)
  const shown = Number.isFinite(h)
    ? `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    : 'Set a time'
  return (
    <div className="relative flex w-full items-stretch pl-4">
      <RowBody last={last} className="justify-between">
        <span className="text-ios-body shrink-0">{label}</span>
        <span className="text-ios-body tnum text-muted-foreground">{shown}</span>
      </RowBody>
      <input
        type="time"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  )
}

/** A multi-line row: the same shape, sized for a sentence. */
export const InsetTextareaRow = React.forwardRef<
  HTMLTextAreaElement,
  {
    value: string
    onChange: (value: string) => void
    placeholder: string
    rows?: number
    last?: boolean
  }
>(({ value, onChange, placeholder, rows = 2, last }, ref) => {
  return (
    <div className="flex w-full items-stretch pl-4">
      <span className={cn('flex min-w-0 flex-1 py-[11px] pr-4', !last && 'hairline-b')}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={rows}
          className="text-ios-body w-full min-w-0 resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </span>
    </div>
  )
})
InsetTextareaRow.displayName = 'InsetTextareaRow'

/** A row that's on or off: a trailing checkmark, as in a Settings picker. */
export function InsetCheckRow({
  label,
  subtitle,
  detail,
  checked,
  onToggle,
  role = 'checkbox',
  last,
}: {
  label: React.ReactNode
  subtitle?: React.ReactNode
  detail?: React.ReactNode
  checked: boolean
  onToggle: () => void
  /** 'radio' when exactly one row in the group is chosen. */
  role?: 'checkbox' | 'radio'
  last?: boolean
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onToggle}
      className="press-row flex w-full items-stretch pl-4 text-left"
    >
      <RowBody last={last} className="gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="text-ios-body block truncate">{label}</span>
          {subtitle && (
            <span className="text-ios-footnote mt-0.5 block text-muted-foreground">{subtitle}</span>
          )}
        </span>
        {detail && <span className="text-ios-body shrink-0 text-muted-foreground">{detail}</span>}
        <Check
          aria-hidden
          strokeWidth={2.6}
          className={cn(
            'h-[18px] w-[18px] shrink-0 text-brand transition-[opacity,transform] duration-base ease-[var(--ease-spring)]',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
      </RowBody>
    </button>
  )
}

/** An iOS switch. The whole row it sits in is the target. */
export function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ease-out',
        checked ? 'bg-success' : 'bg-foreground/15',
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white',
          'shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]',
          'transition-transform duration-300 ease-[var(--ease-spring)]',
          checked && 'translate-x-5',
        )}
      />
    </span>
  )
}

/**
 * UISegmentedControl: a grey track and a raised thumb that slides to the
 * chosen segment, rather than a row of separately highlighted buttons.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid h-8 rounded-[9px] bg-foreground/[0.07] p-[2px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute bottom-[2px] left-[2px] top-[2px] rounded-[7px] bg-segment-thumb shadow-[0_3px_8px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[var(--sheet-ease)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => {
            if (o.value === value) return
            selectionFeedback()
            onChange(o.value)
          }}
          className={cn(
            'text-ios-footnote relative z-10 truncate px-2 font-medium transition-colors duration-base',
            o.value === value ? 'text-foreground' : 'text-foreground/70',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface InsetRowProps {
  /** An icon tile, an avatar — anything that sets the separator's inset. */
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned secondary text: a count, a status. */
  detail?: React.ReactNode
  /** Something other than text at the end of the row: a switch. */
  accessory?: React.ReactNode
  chevron?: boolean
  /** The last row in a group draws no separator. */
  last?: boolean
  destructive?: boolean
  /** A lone action, centred, the way Sign Out sits at the foot of Settings. */
  centered?: boolean
  disabled?: boolean
  onClick?: () => void
  /** For a row that is itself a control, e.g. `switch` with `checked`. */
  role?: 'switch'
  checked?: boolean
}

/** One row: 44pt minimum, a separator that starts under the title. */
export function InsetRow({
  leading,
  title,
  subtitle,
  detail,
  accessory,
  chevron = true,
  last,
  destructive,
  centered,
  disabled,
  onClick,
  role,
  checked,
}: InsetRowProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, disabled } : {})}
      role={role}
      aria-checked={role ? checked : undefined}
      className={cn(
        'flex w-full items-stretch gap-3 pl-4 text-left disabled:opacity-50',
        onClick && 'press-row',
      )}
    >
      {leading && <span className="flex shrink-0 items-center py-[7px]">{leading}</span>}
      <RowBody last={last} className={cn('py-2.5', centered && 'justify-center pl-4')}>
        <span className={cn('min-w-0', !centered && 'flex-1')}>
          <span
            className={cn(
              'text-ios-body block truncate',
              destructive && 'text-danger',
              centered && !destructive && 'text-brand',
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
        {detail !== undefined && detail !== null && (
          <span className="text-ios-body tnum shrink-0 text-muted-foreground">{detail}</span>
        )}
        {accessory}
        {chevron && !centered && onClick && (
          <ChevronRight className="-mr-1 h-[18px] w-[18px] shrink-0 text-muted-foreground/45" />
        )}
      </RowBody>
    </Tag>
  )
}

/**
 * Content that opens and closes in place, easing its height (`.collapsible`
 * in index.css) so everything below it slides rather than jumps. Closed
 * content stays mounted, but inert: out of the tab order and unreachable.
 */
export function Collapsible({
  open,
  className,
  children,
}: {
  open: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="collapsible" data-open={open} inert={!open}>
      <div className={className}>{children}</div>
    </div>
  )
}
