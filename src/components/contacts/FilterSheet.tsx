import * as React from 'react'
import { Check, CircleX, SlidersHorizontal, X } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InsetGroup } from '@/components/ui/inset-list'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_KEYS,
  MEET_SOURCES,
  MEET_SOURCE_KEYS,
  STRENGTH_LABELS,
  tagColor,
} from '@/lib/constants'
import {
  countActiveFilters,
  distinctValues,
  EMPTY_FILTERS,
  type ContactFilters,
  type SortDir,
  type SortKey,
} from '@/lib/filters'
import { formatDate } from '@/lib/format'
import { selectionFeedback, tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { Contact, Tag } from '@/types'

/**
 * The phone's filters: a sheet in the shape of an iOS settings screen, not
 * the desktop popover of 16px checkboxes shrunk onto a phone. Everything
 * applies as it's tapped — the list behind is already filtered by the time
 * the sheet goes away — and the button at the bottom says how many people
 * that leaves.
 */

export interface ContactSort {
  key: SortKey
  dir: SortDir
}

/** The orders a phone offers, each with the direction that one reads in. */
const SORTS: { key: SortKey; dir: SortDir; label: string }[] = [
  { key: 'name', dir: 'asc', label: 'Name' },
  { key: 'lastContact', dir: 'desc', label: 'Recently in touch' },
  { key: 'dateMet', dir: 'desc', label: 'Recently met' },
  { key: 'strength', dir: 'desc', label: 'Closest first' },
  { key: 'company', dir: 'asc', label: 'Company' },
]

export const DEFAULT_SORT: ContactSort = { key: 'name', dir: 'asc' }

/** How many values a long list shows before "Show all". */
const COLLAPSED_ROWS = 5

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

/** The search bar's companion: a filter button that shows when it's doing something. */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onClick()
      }}
      aria-label={count > 0 ? `Filters, ${count} on` : 'Filters'}
      className={cn(
        'press relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
        count > 0 ? 'bg-brand/10 text-brand' : 'bg-bg-sunken text-foreground',
      )}
    >
      <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2.1} />
      {count > 0 && (
        <span className="tnum absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold leading-none text-brand-foreground ring-2 ring-background">
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * What's narrowing the list, as a row of chips under the search bar — each
 * one removes itself when tapped, so undoing a filter never means reopening
 * the sheet to find it.
 */
export function ActiveFilterChips({
  filters,
  tags,
  onChange,
}: {
  filters: ContactFilters
  tags: Tag[]
  onChange: (next: ContactFilters) => void
}) {
  const chips: { key: string; label: React.ReactNode; remove: () => void }[] = []

  if (filters.overdueOnly) {
    chips.push({
      key: 'overdue',
      label: 'Overdue',
      remove: () => onChange({ ...filters, overdueOnly: false }),
    })
  }
  for (const id of filters.tagIds) {
    const tag = tags.find((t) => t.id === id)
    if (!tag) continue
    chips.push({
      key: `tag-${id}`,
      label: (
        <>
          <span className={cn('h-2 w-2 shrink-0 rounded-full', tagColor(tag.color).dot)} />
          {tag.name}
        </>
      ),
      remove: () => onChange({ ...filters, tagIds: filters.tagIds.filter((t) => t !== id) }),
    })
  }
  for (const n of filters.strengths) {
    chips.push({
      key: `strength-${n}`,
      label: STRENGTH_LABELS[n],
      remove: () => onChange({ ...filters, strengths: filters.strengths.filter((s) => s !== n) }),
    })
  }
  for (const k of filters.connectionTypes) {
    chips.push({
      key: `type-${k}`,
      label: CONNECTION_TYPES[k].label,
      remove: () =>
        onChange({ ...filters, connectionTypes: filters.connectionTypes.filter((c) => c !== k) }),
    })
  }
  for (const k of filters.sources) {
    chips.push({
      key: `source-${k}`,
      label: MEET_SOURCES[k].label,
      remove: () => onChange({ ...filters, sources: filters.sources.filter((c) => c !== k) }),
    })
  }
  if (filters.metFrom) {
    chips.push({
      key: 'from',
      label: `Met after ${formatDate(filters.metFrom)}`,
      remove: () => onChange({ ...filters, metFrom: undefined }),
    })
  }
  if (filters.metTo) {
    chips.push({
      key: 'to',
      label: `Met before ${formatDate(filters.metTo)}`,
      remove: () => onChange({ ...filters, metTo: undefined }),
    })
  }
  for (const [field, values] of [
    ['companies', filters.companies],
    ['industries', filters.industries],
    ['whereMet', filters.whereMet],
  ] as const) {
    for (const v of values) {
      chips.push({
        key: `${field}-${v}`,
        label: v,
        remove: () => onChange({ ...filters, [field]: values.filter((x) => x !== v) }),
      })
    }
  }

  if (chips.length === 0) return null

  return (
    <div className="scroll-x-chips -mx-4 mt-2 flex items-center gap-2 pl-4">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => {
            selectionFeedback()
            chip.remove()
          }}
          aria-label={`Remove filter: ${typeof chip.label === 'string' ? chip.label : 'tag'}`}
          className="press text-ios-subhead flex h-8 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-full bg-bg-sunken pl-3 pr-2 text-foreground"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">{chip.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2.5} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          tapFeedback()
          onChange(EMPTY_FILTERS)
        }}
        className="press text-ios-subhead h-8 shrink-0 px-1 text-brand"
      >
        Clear
      </button>
    </div>
  )
}

export function FilterSheet({
  open,
  onOpenChange,
  contacts,
  tags,
  filters,
  onChange,
  sort,
  onSortChange,
  resultCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contacts: Contact[]
  tags: Tag[]
  filters: ContactFilters
  onChange: (next: ContactFilters) => void
  sort: ContactSort
  onSortChange: (next: ContactSort) => void
  resultCount: number
}) {
  const count = countActiveFilters(filters)
  const changed = count > 0 || sort.key !== DEFAULT_SORT.key
  const companies = React.useMemo(() => distinctValues(contacts, 'company'), [contacts])
  const industries = React.useMemo(() => distinctValues(contacts, 'industry'), [contacts])
  const wheres = React.useMemo(() => distinctValues(contacts, 'whereWeMet'), [contacts])

  const set = (patch: Partial<ContactFilters>) => {
    selectionFeedback()
    onChange({ ...filters, ...patch })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose padded={false} aria-describedby={undefined} className="sm:max-w-md">
        {/* The bar iOS puts on a sheet: undo on the left, done on the right. */}
        <DialogHeader>
          <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center px-2">
            <button
              type="button"
              disabled={!changed}
              onClick={() => {
                tapFeedback()
                onChange(EMPTY_FILTERS)
                onSortChange(DEFAULT_SORT)
              }}
              className="press text-ios-body justify-self-start px-2 py-2 text-brand disabled:text-muted-foreground/50"
            >
              Reset
            </button>
            <DialogTitle className="text-ios-headline sm:text-ios-headline">Sort & Filter</DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="press text-ios-body justify-self-end px-2 py-2 font-semibold text-brand"
              >
                Done
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-7 px-4 pb-6 pt-3">
          <InsetGroup title="Sort by">
            {SORTS.map((option, i) => (
              <CheckRow
                key={option.key}
                label={option.label}
                checked={sort.key === option.key}
                last={i === SORTS.length - 1}
                onToggle={() => {
                  selectionFeedback()
                  onSortChange({ key: option.key, dir: option.dir })
                }}
              />
            ))}
          </InsetGroup>

          <InsetGroup footer="People past the catch-up goal you set for them.">
            <SwitchRow
              label="Overdue to catch up"
              checked={filters.overdueOnly}
              onToggle={() => set({ overdueOnly: !filters.overdueOnly })}
            />
          </InsetGroup>

          {tags.length > 0 && (
            <ChipSection
              title="Tags"
              footer={filters.tagIds.length > 1 ? 'Showing people with every tag selected.' : undefined}
            >
              {tags.map((tag) => (
                <Chip
                  key={tag.id}
                  selected={filters.tagIds.includes(tag.id)}
                  onClick={() => set({ tagIds: toggle(filters.tagIds, tag.id) })}
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', tagColor(tag.color).dot)} />
                  {tag.name}
                </Chip>
              ))}
            </ChipSection>
          )}

          <InsetGroup title="Relationship">
            {[5, 4, 3, 2, 1].map((n, i) => (
              <CheckRow
                key={n}
                label={STRENGTH_LABELS[n]}
                checked={filters.strengths.includes(n)}
                last={i === 4}
                onToggle={() => set({ strengths: toggle(filters.strengths, n) })}
              />
            ))}
          </InsetGroup>

          <ChipSection title="Who they are">
            {CONNECTION_TYPE_KEYS.map((k) => (
              <Chip
                key={k}
                selected={filters.connectionTypes.includes(k)}
                onClick={() => set({ connectionTypes: toggle(filters.connectionTypes, k) })}
              >
                <span aria-hidden>{CONNECTION_TYPES[k].emoji}</span>
                {CONNECTION_TYPES[k].label}
              </Chip>
            ))}
          </ChipSection>

          <ChipSection title="How you met">
            {MEET_SOURCE_KEYS.map((k) => (
              <Chip
                key={k}
                selected={filters.sources.includes(k)}
                onClick={() => set({ sources: toggle(filters.sources, k) })}
              >
                <span aria-hidden>{MEET_SOURCES[k].emoji}</span>
                {MEET_SOURCES[k].label}
              </Chip>
            ))}
          </ChipSection>

          <InsetGroup title="Date met">
            <DateRow
              label="After"
              value={filters.metFrom}
              onChange={(metFrom) => set({ metFrom })}
            />
            <DateRow
              label="Before"
              value={filters.metTo}
              onChange={(metTo) => set({ metTo })}
              last
            />
          </InsetGroup>

          {companies.length > 0 && (
            <OptionList
              title="Company"
              options={companies}
              selected={filters.companies}
              onToggle={(v) => set({ companies: toggle(filters.companies, v) })}
            />
          )}
          {industries.length > 0 && (
            <OptionList
              title="Industry"
              options={industries}
              selected={filters.industries}
              onToggle={(v) => set({ industries: toggle(filters.industries, v) })}
            />
          )}
          {wheres.length > 0 && (
            <OptionList
              title="Where you met"
              options={wheres}
              selected={filters.whereMet}
              onToggle={(v) => set({ whereMet: toggle(filters.whereMet, v) })}
            />
          )}
        </div>

        <DialogFooter className="keyboard-padding px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3">
          <Button onClick={() => onOpenChange(false)} className="text-[17px] font-semibold">
            {resultCount === 0
              ? 'No one matches'
              : `Show ${resultCount} ${resultCount === 1 ? 'person' : 'people'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A row that's on or off: a trailing checkmark, as in a Settings picker. */
function CheckRow({
  label,
  checked,
  onToggle,
  last,
}: {
  label: React.ReactNode
  checked: boolean
  onToggle: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="press-row flex w-full items-stretch pl-4 text-left"
    >
      <span
        className={cn(
          'flex min-h-[44px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4',
          !last && 'hairline-b',
        )}
      >
        <span className="text-ios-body min-w-0 flex-1 truncate">{label}</span>
        <Check
          aria-hidden
          strokeWidth={2.6}
          className={cn(
            'h-[18px] w-[18px] shrink-0 text-brand transition-[opacity,transform] duration-base ease-[var(--ease-spring)]',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
      </span>
    </button>
  )
}

/** A row with an iOS switch at its end; the whole row is the target. */
function SwitchRow({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 py-1.5 pl-4 pr-3 text-left"
    >
      <span className="text-ios-body min-w-0 flex-1">{label}</span>
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
    </button>
  )
}

/** A labelled cloud of capsules, for short option sets that read at a glance. */
function ChipSection({
  title,
  footer,
  children,
}: {
  title: string
  footer?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-ios-footnote px-4 pb-2 font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">{children}</div>
      {footer && <p className="text-ios-footnote px-4 pt-2 text-muted-foreground">{footer}</p>}
    </section>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'press-scale text-ios-subhead inline-flex h-9 items-center gap-1.5 rounded-full px-3.5',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-bg-sunken text-foreground ring-1 ring-inset ring-border/60',
      )}
    >
      {children}
    </button>
  )
}

/**
 * A date as a row. The real `<input type="date">` lies invisibly over it, so
 * a tap opens iOS's own calendar rather than a web date field.
 */
function DateRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string
  value?: string
  onChange: (value: string | undefined) => void
  last?: boolean
}) {
  return (
    <div className="relative flex w-full items-stretch pl-4">
      <span
        className={cn(
          'flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-2 pr-3',
          !last && 'hairline-b',
        )}
      >
        <span className="text-ios-body shrink-0">{label}</span>
        <span
          className={cn(
            'text-ios-body truncate',
            value ? 'text-foreground' : 'text-muted-foreground',
            // Leaves the clear button's slot free of the invisible input.
            value && 'pr-9',
          )}
        >
          {value ? formatDate(value) : 'Any date'}
        </span>
      </span>
      <input
        type="date"
        aria-label={`Met ${label.toLowerCase()}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn('absolute inset-y-0 left-0 h-full opacity-0', value ? 'right-11' : 'right-0')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`Clear the ${label.toLowerCase()} date`}
          className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground/70"
        >
          <CircleX className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  )
}

/**
 * A long list of values (every company in someone's contacts). Shows the
 * first few, plus anything already chosen, until asked for the rest.
 */
function OptionList({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const collapsible = options.length > COLLAPSED_ROWS + 1
  const shown =
    expanded || !collapsible
      ? options
      : options.filter((v, i) => i < COLLAPSED_ROWS || selected.includes(v))
  const hidden = options.length - shown.length

  return (
    <InsetGroup title={title}>
      {shown.map((v, i) => (
        <CheckRow
          key={v}
          label={v}
          checked={selected.includes(v)}
          onToggle={() => onToggle(v)}
          last={i === shown.length - 1 && hidden === 0 && !(collapsible && expanded)}
        />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="press-row text-ios-body flex min-h-[44px] w-full items-center pl-4 text-left text-brand"
        >
          Show all {options.length}
        </button>
      )}
      {collapsible && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="press-row text-ios-body flex min-h-[44px] w-full items-center pl-4 text-left text-brand"
        >
          Show fewer
        </button>
      )}
    </InsetGroup>
  )
}
