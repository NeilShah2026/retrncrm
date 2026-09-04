import * as React from 'react'
import { Link } from 'react-router-dom'
import { format, isSameDay, isToday, isTomorrow, parseISO } from 'date-fns'
import { CalendarDays, CalendarPlus, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { CalendarEvent, Contact } from '@/types'

interface Props {
  events: CalendarEvent[]
  contactMap: Map<string, Contact>
  /** How many meetings to list before deferring to the calendar page. */
  limit?: number
}

/** "Today" / "Tomorrow" / "Thu, Mar 14" — the only three cases worth naming. */
function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEE, MMM d')
}

/**
 * The next few meetings with people in the network, on the page people land
 * on. The calendar page owns the month grid and the whole schedule; this is
 * just the part you need before you close the tab — who you're seeing, when,
 * and a way to add one without leaving.
 */
export function UpcomingMeetings({ events, contactMap, limit = 5 }: Props) {
  const [formOpen, setFormOpen] = React.useState(false)

  const upcoming = React.useMemo(() => {
    const now = Date.now()
    return events
      .map((event) => ({ event, at: parseISO(event.startsAt) }))
      .filter(({ event, at }) => {
        // An all-day event is "upcoming" for the whole of its day.
        if (event.allDay) return parseISO(event.endsAt).getTime() >= now || isToday(at)
        return parseISO(event.endsAt).getTime() >= now
      })
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, limit)
  }, [events, limit])

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-sky-500" />
            <h2 className="font-semibold">Upcoming meetings</h2>
          </div>
          <Link
            to={ROUTES.calendar}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Calendar
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing scheduled. Book a coffee chat and it shows on their
              profile too.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(true)}
              className="mt-3 gap-2"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Schedule a meeting
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {upcoming.map(({ event, at }, i) => {
                const previous = upcoming[i - 1]
                const newDay = !previous || !isSameDay(previous.at, at)
                const attendees = event.contactIds
                  .map((id) => contactMap.get(id))
                  .filter((c): c is Contact => Boolean(c))

                return (
                  <li key={event.id}>
                    {newDay && (
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {dayLabel(at)}
                      </p>
                    )}
                    <Link
                      to={ROUTES.calendar}
                      className="block rounded-lg border p-3 transition-colors hover:bg-accent/50"
                    >
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.allDay ? 'All day' : format(at, 'h:mm a')}
                        </span>
                        {event.location && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                      </div>
                      {attendees.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {attendees.slice(0, 3).map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-accent/40 py-0.5 pl-0.5 pr-2 text-[11px]"
                            >
                              <ContactAvatar contact={c} className="h-5 w-5 text-[8px]" />
                              {fullName(c)}
                            </span>
                          ))}
                          {attendees.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{attendees.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(true)}
              className="mt-4 w-full gap-2"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              New meeting
            </Button>
          </>
        )}
      </CardContent>

      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </Card>
  )
}
