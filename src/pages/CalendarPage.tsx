import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  addMonths,
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
  CalendarClock,
  CalendarDays,
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
import { useEvents, useOpportunities, useContactMap } from '@/hooks/useData'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Contact, Opportunity } from '@/types'

type View = 'month' | 'agenda'

type Item =
  | { kind: 'event'; date: Date; event: CalendarEvent }
  | { kind: 'deadline'; date: Date; opp: Opportunity }

export function CalendarPage() {
  const events = useEvents()
  const opportunities = useOpportunities()
  const contactMap = useContactMap()
  const [searchParams, setSearchParams] = useSearchParams()

  const [view, setView] = React.useState<View>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? 'agenda'
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
          out.push({ kind: 'deadline', date: parseISO(o.deadline), opp: o })
        }
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events, opportunities, showDeadlines])

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

  const viewSwitch = (
    <div className="flex h-8 items-center rounded-md border p-0.5" role="group" aria-label="View">
      {(['month', 'agenda'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          aria-pressed={view === v}
          className={cn(
            'flex h-full flex-1 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-medium capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:flex-none',
            view === v ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v === 'month' ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
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
        toolbar: viewSwitch,
        trailing: (
          <>
            <BarButton onClick={() => setSyncOpen(true)} aria-label="Subscribe to this calendar">
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
          <Button variant="outline" onClick={() => setSyncOpen(true)}>
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
        {view === 'month' ? (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
              <ChevronLeft />
            </Button>
            <span className="tnum min-w-[8.5rem] text-center text-sm font-semibold">
              {format(cursor, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
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

      {view === 'month' ? (
        <MonthGrid cursor={cursor} items={items} onDayClick={(d) => openNew(format(d, 'yyyy-MM-dd'))} onEventClick={openEdit} />
      ) : (
        <AgendaList items={items} contactMap={contactMap} onEventClick={openEdit} onNew={() => openNew()} />
      )}

      <CalendarSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} defaultDate={defaultDate} />
    </PageShell>
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
                {dayItems.slice(0, 3).map((it, i) =>
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
                      key={`d-${it.opp.id}-${i}`}
                      to={ROUTES.pipeline}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate rounded-sm bg-warning-soft px-1 py-px text-[11px] leading-4 text-warning"
                    >
                      Due: {it.opp.company}
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
            {dayItems.map((it, i) =>
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
                <li key={`d-${it.opp.id}-${i}`} className="border-b last:border-b-0">
                  <Link
                    to={ROUTES.pipeline}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-accent/50"
                  >
                    <span className="flex w-24 shrink-0 items-center gap-1 text-xs text-warning">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Deadline
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {it.opp.company} · {it.opp.role}
                      </span>
                      <span className="block text-xs text-muted-foreground">Application due</span>
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
