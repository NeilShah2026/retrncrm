import * as React from 'react'
import { Link } from 'react-router-dom'
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
  CalendarDays,
  CalendarPlus,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  MapPin,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { EmptyState } from '@/components/common/EmptyState'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { CalendarSyncDialog } from '@/components/calendar/CalendarSyncDialog'
import { useEvents, useOpportunities, useContactMap } from '@/hooks/useData'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Opportunity } from '@/types'

type View = 'month' | 'agenda'

/** A meeting, or an opportunity deadline, placed on a day. */
type Item =
  | { kind: 'event'; date: Date; event: CalendarEvent }
  | { kind: 'deadline'; date: Date; opp: Opportunity }

export function CalendarPage() {
  const events = useEvents()
  const opportunities = useOpportunities()
  const contactMap = useContactMap()

  const [view, setView] = React.useState<View>('month')
  const [showDeadlines, setShowDeadlines] = React.useState(true)
  const [cursor, setCursor] = React.useState(() => new Date())
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = React.useState<string | undefined>()
  const [syncOpen, setSyncOpen] = React.useState(false)

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const e of events ?? []) {
      out.push({ kind: 'event', date: parseISO(e.startsAt), event: e })
    }
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

  return (
    <PageShell
      width="wide"
      header={
        <PageHeader
          title="Calendar"
          description="Meetings with the people in your network."
        >
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-lg border p-0.5 sm:flex">
              <button
                onClick={() => setView('month')}
                aria-label="Month view"
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  view === 'month'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Month
              </button>
              <button
                onClick={() => setView('agenda')}
                aria-label="Agenda view"
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  view === 'agenda'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List className="h-3.5 w-3.5" /> Agenda
              </button>
            </div>
            <Button
              variant="outline"
              onClick={() => setSyncOpen(true)}
              className="gap-2"
              aria-label="Subscribe to calendar"
            >
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Subscribe</span>
            </Button>
            <Button onClick={() => openNew()} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New meeting</span>
            </Button>
          </div>
        </PageHeader>
      }
    >
      {/* Toolbar: month nav (month view) + deadlines toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {view === 'month' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9rem] text-center text-sm font-semibold">
              {format(cursor, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(new Date())}
              className="ml-1 text-xs"
            >
              Today
            </Button>
          </div>
        ) : (
          <span className="text-sm font-semibold">Upcoming</span>
        )}

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showDeadlines}
              onChange={(e) => setShowDeadlines(e.target.checked)}
              className="accent-indigo-500"
            />
            Show deadlines
          </label>
          {/* Mobile view toggle */}
          <div className="flex items-center rounded-lg border p-0.5 sm:hidden">
            <button
              onClick={() => setView('month')}
              aria-label="Month view"
              className={cn(
                'rounded-md px-2 py-1',
                view === 'month' ? 'bg-accent' : 'text-muted-foreground',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('agenda')}
              aria-label="Agenda view"
              className={cn(
                'rounded-md px-2 py-1',
                view === 'agenda' ? 'bg-accent' : 'text-muted-foreground',
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid
          cursor={cursor}
          items={items}
          onDayClick={(d) => openNew(format(d, 'yyyy-MM-dd'))}
          onEventClick={openEdit}
        />
      ) : (
        <AgendaList
          items={items}
          contactMap={contactMap}
          onEventClick={openEdit}
          onNew={() => openNew()}
        />
      )}

      <CalendarSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        defaultDate={defaultDate}
      />
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
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((i) => isSameDay(i.date, day))
          const outside = !isSameMonth(day, cursor)
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'min-h-[5.5rem] border-b border-r p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-accent/40 sm:min-h-[7rem]',
                outside && 'bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  isToday(day) && 'bg-indigo-500 font-semibold text-white',
                  outside && 'text-muted-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {dayItems.slice(0, 3).map((it, i) =>
                  it.kind === 'event' ? (
                    <span
                      key={it.event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(it.event)
                      }}
                      className="block truncate rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-500/25 dark:text-indigo-300"
                    >
                      {!it.event.allDay && format(it.date, 'h:mm')} {it.event.title}
                    </span>
                  ) : (
                    <span
                      key={`d-${it.opp.id}-${i}`}
                      className="block truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                    >
                      ⏳ {it.opp.company}
                    </span>
                  ),
                )}
                {dayItems.length > 3 && (
                  <span className="block px-1.5 text-[10px] text-muted-foreground">
                    +{dayItems.length - 3} more
                  </span>
                )}
              </div>
            </button>
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
  contactMap: Map<string, import('@/types').Contact>
  onEventClick: (e: CalendarEvent) => void
  onNew: () => void
}) {
  // Only what's ahead (plus today), grouped by day.
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
        icon={CalendarDays}
        title="Nothing scheduled"
        description="Schedule a coffee chat, call, or meeting with someone in your network — it'll show on their profile and sync to your calendar."
        action={<Button onClick={onNew}>Schedule a meeting</Button>}
      />
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(([key, dayItems]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {format(parseISO(key), 'EEEE, MMM d')}
          </p>
          <div className="space-y-2">
            {dayItems.map((it, i) =>
              it.kind === 'event' ? (
                <Card key={it.event.id}>
                  <CardContent className="p-3.5">
                    <button
                      onClick={() => onEventClick(it.event)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {it.event.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {it.event.allDay
                                ? 'All day'
                                : `${format(parseISO(it.event.startsAt), 'h:mm a')} – ${format(parseISO(it.event.endsAt), 'h:mm a')}`}
                            </span>
                            {it.event.location && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3" />
                                {it.event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    {it.event.contactIds.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {it.event.contactIds.map((id) => {
                          const c = contactMap.get(id)
                          if (!c) return null
                          return (
                            <Link
                              key={id}
                              to={ROUTES.contact(id)}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-accent/40 py-0.5 pl-0.5 pr-2 text-xs transition-colors hover:bg-accent"
                            >
                              <ContactAvatar contact={c} className="h-5 w-5 text-[9px]" />
                              {fullName(c)}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Link
                  key={`d-${it.opp.id}-${i}`}
                  to={ROUTES.pipeline}
                  className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5"
                >
                  <span className="text-base">⏳</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {it.opp.company} — {it.opp.role}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Application deadline
                    </p>
                  </div>
                </Link>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
