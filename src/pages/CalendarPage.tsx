import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  AlarmClock,
  Cake,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  CalendarPlus,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  MapPin,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { EmptyState } from '@/components/common/EmptyState'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { CalendarSyncDialog } from '@/components/calendar/CalendarSyncDialog'
import { useFeatureGate } from '@/hooks/useFeatureGate'
import {
  useContactMap,
  useEvents,
  useFollowUps,
  useKeyDates,
  useOpportunities,
} from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { fullName } from '@/lib/format'
import { nextOccurrence } from '@/lib/keyDates'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Contact } from '@/types'

type View = 'month' | 'week' | 'agenda'

/**
 * Anything on a day that isn't a meeting — an application deadline, a
 * follow-up, a birthday. They render the same way everywhere: a short tag,
 * a title, and a link to where the thing lives.
 */
interface Marker {
  kind: 'marker'
  date: Date
  key: string
  type: 'deadline' | 'follow-up' | 'key-date'
  /** "Due", "Follow up", "Birthday" — the column label in week and agenda views. */
  tag: string
  /** Short enough for a month-grid cell. */
  short: string
  title: string
  subtitle: string
  to: string
}

type Item = { kind: 'event'; date: Date; event: CalendarEvent } | Marker

const MARKER_STYLE: Record<Marker['type'], { text: string; chip: string; icon: typeof Cake }> = {
  deadline: { text: 'text-warning', chip: 'bg-warning-soft text-warning', icon: CalendarClock },
  'follow-up': { text: 'text-brand', chip: 'bg-brand/10 text-brand', icon: AlarmClock },
  'key-date': { text: 'text-text-secondary', chip: 'bg-foreground/[0.06] text-text-secondary', icon: Cake },
}

export function CalendarPage() {
  const gate = useFeatureGate()
  const events = useEvents()
  const opportunities = useOpportunities()
  const followUps = useFollowUps()
  const keyDates = useKeyDates()
  const contactMap = useContactMap()
  const [searchParams, setSearchParams] = useSearchParams()

  const isMobile = useIsMobile()
  // A phone gets a week where a desktop gets a month — see WeekView.
  const [view, setView] = React.useState<View>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? 'week'
      : 'month',
  )
  const [showDeadlines, setShowDeadlines] = React.useState(true)
  const [cursor, setCursor] = React.useState(() => new Date())
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = React.useState<string | undefined>()
  const [syncOpen, setSyncOpen] = React.useState(false)

  // ⌘K → "Schedule a meeting" lands here with ?new=1.
  React.useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null)
      setDefaultDate(undefined)
      setFormOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const e of events ?? []) out.push({ kind: 'event', date: parseISO(e.startsAt), event: e })
    if (showDeadlines) {
      for (const o of opportunities ?? []) {
        if (o.deadline && o.stage !== 'closed') {
          out.push({
            kind: 'marker',
            type: 'deadline',
            key: `deadline-${o.id}`,
            date: parseISO(o.deadline),
            tag: 'Due',
            short: `Due: ${o.company}`,
            title: `${o.company} · ${o.role}`,
            subtitle: 'Application due',
            to: ROUTES.pipeline,
          })
        }
      }
    }
    for (const f of followUps ?? []) {
      const contact = contactMap.get(f.contactId)
      if (f.completedAt || !contact) continue
      out.push({
        kind: 'marker',
        type: 'follow-up',
        key: `follow-up-${f.id}`,
        date: parseISO(f.dueDate),
        tag: 'Follow up',
        short: `↩ ${contact.firstName}`,
        title: f.note || `Follow up with ${fullName(contact)}`,
        subtitle: fullName(contact),
        to: ROUTES.contact(contact.id),
      })
    }
    // A key date recurs, so it's placed in last year, this year and next —
    // enough for any month someone pages to from here.
    const thisYear = new Date().getFullYear()
    for (const k of keyDates ?? []) {
      const contact = contactMap.get(k.contactId)
      if (!contact) continue
      for (const year of [thisYear - 1, thisYear, thisYear + 1]) {
        const date = nextOccurrence(k, new Date(year, 0, 1))
        if (date.getFullYear() !== year) continue
        const birthday = /birthday/i.test(k.label)
        out.push({
          kind: 'marker',
          type: 'key-date',
          key: `key-date-${k.id}-${year}`,
          date,
          tag: birthday ? 'Birthday' : 'Date',
          short: birthday ? `🎂 ${contact.firstName}` : `${contact.firstName}: ${k.label}`,
          title: birthday ? `${fullName(contact)}’s birthday` : `${fullName(contact)} · ${k.label}`,
          subtitle: k.label,
          to: ROUTES.contact(contact.id),
        })
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events, opportunities, followUps, keyDates, contactMap, showDeadlines])

  function openNew(dateStr?: string) {
    setEditing(null)
    setDefaultDate(dateStr)
    setFormOpen(true)
  }
  function openEdit(e: CalendarEvent) {
    setEditing(e)
    setDefaultDate(undefined)
    setFormOpen(true)
  }

  // The calendar view always follows the viewport: a phone gets the week, a
  // desktop the month. Only the agenda is a real choice, so a stale 'month'
  // from a wider window can never put the cramped grid back on a phone.
  const effectiveView: View = view === 'agenda' ? 'agenda' : isMobile ? 'week' : 'month'
  const viewSwitch = (
    <div className="flex h-8 items-center rounded-md border p-0.5" role="group" aria-label="View">
      {([isMobile ? 'week' : 'month', 'agenda'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          aria-pressed={effectiveView === v}
          className={cn(
            'flex h-full flex-1 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-medium capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:flex-none',
            effectiveView === v ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v === 'agenda' ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          {v}
        </button>
      ))}
    </div>
  )

  return (
    <PageShell
      width="wide"
      mobile={{
        title: 'Calendar',
        // Compact title, with the view switch pinned directly beneath it —
        // a segmented control belongs under the title, not above it.
        largeTitle: false,
        toolbar: viewSwitch,
        trailing: (
          <>
            <BarButton onClick={() => gate.require('calendarSync') && setSyncOpen(true)} aria-label="Subscribe to this calendar">
              <CalendarCheck />
            </BarButton>
            <BarButton onClick={() => openNew()} aria-label="New meeting">
              <CalendarPlus />
            </BarButton>
          </>
        ),
      }}
      header={
        <PageHeader title="Calendar" description="Meetings with the people in your network.">
          <span className="hidden sm:block">{viewSwitch}</span>
          <Button variant="outline" onClick={() => gate.require('calendarSync') && setSyncOpen(true)}>
            <CalendarCheck />
            <span className="hidden sm:inline">Subscribe</span>
          </Button>
          <Button onClick={() => openNew()}>
            <CalendarPlus />
            <span className="hidden sm:inline">New meeting</span>
          </Button>
        </PageHeader>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {effectiveView !== 'agenda' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCursor((c) => (effectiveView === 'week' ? addWeeks(c, -1) : addMonths(c, -1)))}
              aria-label={effectiveView === 'week' ? 'Previous week' : 'Previous month'}
            >
              <ChevronLeft />
            </Button>
            <span className="tnum min-w-[8.5rem] text-center text-sm font-semibold">
              {format(cursor, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCursor((c) => (effectiveView === 'week' ? addWeeks(c, 1) : addMonths(c, 1)))}
              aria-label={effectiveView === 'week' ? 'Next week' : 'Next month'}
            >
              <ChevronRight />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())} className="ml-1">
              Today
            </Button>
          </div>
        ) : (
          <span className="text-sm font-semibold">Upcoming</span>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <Checkbox checked={showDeadlines} onCheckedChange={(v) => setShowDeadlines(Boolean(v))} />
          Show application deadlines
        </label>
      </div>

      {effectiveView === 'week' ? (
        <WeekView cursor={cursor} items={items} onDayClick={(d) => openNew(format(d, 'yyyy-MM-dd'))} onEventClick={openEdit} />
      ) : effectiveView === 'month' ? (
        <MonthGrid cursor={cursor} items={items} onDayClick={(d) => openNew(format(d, 'yyyy-MM-dd'))} onEventClick={openEdit} />
      ) : (
        <AgendaList items={items} contactMap={contactMap} onEventClick={openEdit} onNew={() => openNew()} />
      )}

      <CalendarSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} defaultDate={defaultDate} />
    </PageShell>
  )
}

/**
 * The phone's calendar. A month grid on a 400pt screen gives each day about
 * 50pt to hold a date, a time and a title, which is why it reads as squeezed
 * — so the phone gets a week instead: one strip you can see the whole week
 * in, and the days themselves listed underneath at a readable size.
 */
function WeekView({
  cursor,
  items,
  onDayClick,
  onEventClick,
}: {
  cursor: Date
  items: Item[]
  onDayClick: (d: Date) => void
  onEventClick: (e: CalendarEvent) => void
}) {
  const days = React.useMemo(
    () => eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) }),
    [cursor],
  )
  const withItems = days
    .map((day) => ({ day, dayItems: items.filter((i) => isSameDay(i.date, day)) }))
    .filter(({ dayItems }) => dayItems.length > 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = items.filter((i) => isSameDay(i.date, day)).length
          const today = isToday(day)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              className="press-scale flex flex-col items-center gap-1 rounded-[12px] py-1.5"
              aria-label={`${format(day, 'EEEE d MMMM')}, ${count} ${count === 1 ? 'item' : 'items'}`}
            >
              <span className="text-ios-caption text-muted-foreground">
                {format(day, 'EEEEE')}
              </span>
              <span
                className={cn(
                  'tnum flex h-9 w-9 items-center justify-center rounded-full text-[17px]',
                  today
                    ? 'bg-brand font-semibold text-brand-foreground'
                    : 'text-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              <span
                className={cn(
                  'h-1 w-1 rounded-full',
                  count > 0 ? (today ? 'bg-brand' : 'bg-text-muted') : 'bg-transparent',
                )}
                aria-hidden
              />
            </button>
          )
        })}
      </div>

      {withItems.length === 0 ? (
        <p className="text-ios-subhead py-10 text-center text-muted-foreground">
          Nothing this week. Tap a day to add something.
        </p>
      ) : (
        withItems.map(({ day, dayItems }) => (
          <section key={day.toISOString()}>
            <h3 className="text-ios-footnote px-4 pb-1.5 font-medium uppercase tracking-[0.05em] text-muted-foreground">
              {format(day, 'EEEE d MMM')}
            </h3>
            <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-inset ring-border/70">
              {dayItems.map((it, i) =>
                it.kind === 'event' ? (
                  <button
                    key={it.event.id}
                    type="button"
                    onClick={() => onEventClick(it.event)}
                    className="press-row flex w-full items-stretch gap-3 pl-4 text-left"
                  >
                    <span className="tnum text-ios-footnote flex w-12 shrink-0 items-center text-muted-foreground">
                      {it.event.allDay ? 'All day' : format(it.date, 'h:mm a')}
                    </span>
                    <span
                      className={cn(
                        'flex min-w-0 flex-1 items-center py-3 pr-4',
                        i < dayItems.length - 1 && 'hairline-b',
                      )}
                    >
                      <span className="text-ios-body truncate">{it.event.title}</span>
                    </span>
                  </button>
                ) : (
                  <Link
                    key={it.key}
                    to={it.to}
                    className="press-row flex w-full items-stretch gap-3 pl-4 text-left"
                  >
                    <span
                      className={cn(
                        'text-ios-footnote flex w-12 shrink-0 items-center leading-tight',
                        MARKER_STYLE[it.type].text,
                      )}
                    >
                      {it.tag}
                    </span>
                    <span
                      className={cn(
                        'flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-4',
                        i < dayItems.length - 1 && 'hairline-b',
                      )}
                    >
                      <span className="text-ios-body truncate">{it.title}</span>
                      {it.type !== 'deadline' && (
                        <span className="text-ios-footnote truncate text-muted-foreground">{it.subtitle}</span>
                      )}
                    </span>
                  </Link>
                ),
              )}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function MonthGrid({
  cursor,
  items,
  onDayClick,
  onEventClick,
}: {
  cursor: Date
  items: Item[]
  onDayClick: (d: Date) => void
  onEventClick: (e: CalendarEvent) => void
}) {
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const end = endOfWeek(endOfMonth(cursor))
    return eachDayOfInterval({ start, end })
  }, [cursor])

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-bg-sunken">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-label px-1 py-1.5 text-center text-muted-foreground">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((i) => isSameDay(i.date, day))
          const outside = !isSameMonth(day, cursor)
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onDayClick(day)
              }}
              className={cn(
                'min-h-[5.5rem] cursor-pointer border-b border-r p-1 text-left align-top transition-colors duration-fast hover:bg-accent/40 focus-visible:bg-accent focus-visible:outline-none sm:min-h-[6.5rem] [&:nth-child(7n)]:border-r-0',
                outside && 'bg-bg-sunken/40',
              )}
            >
              <span
                className={cn(
                  'tnum inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  today && 'bg-brand font-semibold text-brand-foreground',
                  outside && !today && 'text-muted-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayItems.slice(0, 3).map((it) =>
                  it.kind === 'event' ? (
                    <button
                      key={it.event.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(it.event)
                      }}
                      className="block w-full truncate rounded-sm border bg-background px-1 py-px text-left text-[11px] leading-4 transition-colors duration-fast hover:border-border-strong"
                    >
                      {!it.event.allDay && (
                        <span className="tnum text-muted-foreground">{format(it.date, 'h:mm')} </span>
                      )}
                      {it.event.title}
                    </button>
                  ) : (
                    <Link
                      key={it.key}
                      to={it.to}
                      title={it.title}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'block truncate rounded-sm px-1 py-px text-[11px] leading-4',
                        MARKER_STYLE[it.type].chip,
                      )}
                    >
                      {it.short}
                    </Link>
                  ),
                )}
                {dayItems.length > 3 && (
                  <span className="block px-1 text-[11px] text-muted-foreground">+{dayItems.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgendaList({
  items,
  contactMap,
  onEventClick,
  onNew,
}: {
  items: Item[]
  contactMap: Map<string, Contact>
  onEventClick: (e: CalendarEvent) => void
  onNew: () => void
}) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const upcoming = items.filter((i) => i.date >= startOfToday)

  const groups = React.useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of upcoming) {
      const key = format(it.date, 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), it])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [upcoming])

  if (groups.length === 0) {
    return (
      <EmptyState
        variant="first-run"
        icon={CalendarDays}
        title="Nothing scheduled"
        description="Schedule a coffee chat or call with someone in your network. It shows on their profile and syncs to your calendar."
        action={
          <Button onClick={onNew}>
            <CalendarPlus />
            Schedule a meeting
          </Button>
        }
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {groups.map(([key, dayItems]) => (
        <div key={key} className="border-b last:border-b-0">
          <p className="text-label border-b bg-bg-sunken/60 px-3 py-1 text-muted-foreground">
            {format(parseISO(key), 'EEEE, MMM d')}
          </p>
          <ul>
            {dayItems.map((it) =>
              it.kind === 'event' ? (
                <li key={it.event.id} className="border-b last:border-b-0">
                  <button
                    onClick={() => onEventClick(it.event)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-fast hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <time className="tnum w-24 shrink-0 pt-px text-xs text-muted-foreground">
                      {it.event.allDay
                        ? 'All day'
                        : `${format(parseISO(it.event.startsAt), 'h:mm a')} – ${format(parseISO(it.event.endsAt), 'h:mm a')}`}
                    </time>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{it.event.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {it.event.contactIds.map((id) => {
                          const c = contactMap.get(id)
                          if (!c) return null
                          return (
                            <Link
                              key={id}
                              to={ROUTES.contact(id)}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              <ContactAvatar contact={c} className="h-4 w-4" />
                              {fullName(c)}
                            </Link>
                          )
                        })}
                        {it.event.location && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{it.event.location}</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ) : (
                <li key={it.key} className="border-b last:border-b-0">
                  <Link
                    to={it.to}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-accent/50"
                  >
                    <MarkerTag marker={it} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{it.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{it.subtitle}</span>
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}

function MarkerTag({ marker }: { marker: Marker }) {
  const { text, icon } = MARKER_STYLE[marker.type]
  const Icon = marker.type === 'key-date' && marker.tag !== 'Birthday' ? CalendarHeart : icon
  return (
    <span className={cn('flex w-24 shrink-0 items-center gap-1 text-xs', text)}>
      <Icon className="h-3.5 w-3.5" />
      {marker.type === 'deadline' ? 'Deadline' : marker.tag}
    </span>
  )
}
