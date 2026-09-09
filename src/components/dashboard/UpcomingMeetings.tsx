import * as React from 'react'
import { Link } from 'react-router-dom'
import { format, isSameDay, isToday, isTomorrow, parseISO } from 'date-fns'
import { CalendarPlus, MapPin } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { CalendarEvent, Contact } from '@/types'

interface Props {
  events: CalendarEvent[]
  contactMap: Map<string, Contact>
  limit?: number
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEE, MMM d')
}

/** The next few meetings with people in the network. */
export function UpcomingMeetings({ events, contactMap, limit = 5 }: Props) {
  const [formOpen, setFormOpen] = React.useState(false)

  const upcoming = React.useMemo(() => {
    const now = Date.now()
    return events
      .map((event) => ({ event, at: parseISO(event.startsAt) }))
      .filter(({ event, at }) => {
        if (event.allDay) return parseISO(event.endsAt).getTime() >= now || isToday(at)
        return parseISO(event.endsAt).getTime() >= now
      })
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, limit)
  }, [events, limit])

  return (
    <Panel>
      <PanelHeader
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setFormOpen(true)}
            aria-label="New meeting"
            title="New meeting"
    <Card className="h-full">
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
            <CalendarPlus />
          </Button>
        }
      >
        Upcoming
      </PanelHeader>

      {upcoming.length === 0 ? (
        <div className="px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Nothing scheduled. Book a coffee chat and it shows on their profile too.
          </p>
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} className="mt-3">
            <CalendarPlus />
            Schedule a meeting
          </Button>
        </div>
      ) : (
        <ul>
          {upcoming.map(({ event, at }, i) => {
            const previous = upcoming[i - 1]
            const newDay = !previous || !isSameDay(previous.at, at)
            const attendees = event.contactIds
              .map((id) => contactMap.get(id))
              .filter((c): c is Contact => Boolean(c))

            return (
              <li key={event.id} className="border-b last:border-b-0">
                {newDay && (
                  <p className="text-label border-b bg-bg-sunken/60 px-4 py-1 text-muted-foreground">
                    {dayLabel(at)}
                  </p>
                )}
                <Link
                  to={ROUTES.calendar}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-fast hover:bg-accent/50"
                >
                  <time className="tnum w-14 shrink-0 pt-px text-xs text-muted-foreground">
                    {event.allDay ? 'All day' : format(at, 'h:mm a')}
                  </time>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{event.title}</span>
                    {(event.location || attendees.length > 0) && (
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {attendees.slice(0, 3).map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1">
                            <ContactAvatar contact={c} className="h-4 w-4" />
                            {fullName(c)}
                          </span>
                        ))}
                        {attendees.length > 3 && <span>+{attendees.length - 3}</span>}
                        {event.location && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </Panel>
  )
}
