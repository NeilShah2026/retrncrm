import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  AlarmClock,
  CalendarClock,
  Check,
  Gift,
  Inbox as InboxIcon,
  KanbanSquare,
  NotebookPen,
  type LucideIcon,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { MeetingNotesDialog } from '@/components/calendar/MeetingNotesDialog'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { completeFollowUp } from '@/components/reminders/followUpActions'
import { markCaughtUp } from '@/lib/caughtUp'
import { describeDue } from '@/lib/followUps'
import { fullName } from '@/lib/format'
import { skipMeetingNotes, useInbox } from '@/lib/inbox'
import { getReconnectStatus } from '@/lib/reconnect'
import { ROUTES } from '@/lib/routes'
import type { CalendarEvent, Contact } from '@/types'

/**
 * Everything waiting on you, in one place: follow-ups that are due, meetings
 * to write up, deadlines, birthdays, and the people you've gone quiet on.
 * Each row has the one action that clears it.
 */
export function InboxPage() {
  const navigate = useNavigate()
  const inbox = useInbox()
  const [notesFor, setNotesFor] = React.useState<CalendarEvent | null>(null)

  const header = (
    <PageHeader
      title="Inbox"
      description="What needs doing. Everything here clears itself once it’s done."
    />
  )

  return (
    <PageShell mobile={{ title: 'Inbox' }} header={header}>
      {!inbox.ready ? (
        <InboxSkeleton />
      ) : inbox.count === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="You’re all caught up"
          description="No follow-ups due, no meetings to write up, and nobody overdue. New things land here as they come due."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4 pb-2">
          {inbox.followUps.length > 0 && (
            <Section icon={AlarmClock} title="Follow-ups due" count={inbox.followUps.length}>
              {inbox.followUps.map(({ followUp, contact }) => (
                <Row
                  key={followUp.id}
                  contact={contact}
                  icon={AlarmClock}
                  title={followUp.note?.trim() || (contact ? `Follow up with ${fullName(contact)}` : 'Follow up')}
                  subtitle={[contact && fullName(contact), describeDue(followUp.dueDate)]
                    .filter(Boolean)
                    .join(' · ')}
                  urgent={followUp.dueDate < format(new Date(), 'yyyy-MM-dd')}
                  onOpen={contact ? () => navigate(ROUTES.contact(contact.id)) : undefined}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Mark done"
                      onClick={() => void completeFollowUp(followUp, contact)}
                    >
                      <Check />
                      <span className="hidden sm:inline">Done</span>
                    </Button>
                  }
                />
              ))}
            </Section>
          )}

          {inbox.meetings.length > 0 && (
            <Section icon={NotebookPen} title="Meetings to write up" count={inbox.meetings.length}>
              {inbox.meetings.map(({ event, attendees }) => (
                <Row
                  key={event.id}
                  contact={attendees[0]}
                  icon={CalendarClock}
                  title={event.title}
                  subtitle={[
                    format(parseISO(event.startsAt), event.allDay ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a'),
                    attendees.map(fullName).join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onOpen={() => setNotesFor(event)}
                  action={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => skipMeetingNotes(event.id)}
                        title="Nothing worth noting"
                      >
                        Skip
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Add notes"
                        onClick={() => setNotesFor(event)}
                      >
                        <NotebookPen />
                        <span className="hidden sm:inline">Add notes</span>
                      </Button>
                    </>
                  }
                />
              ))}
            </Section>
          )}

          {inbox.deadlines.length > 0 && (
            <Section icon={KanbanSquare} title="Deadlines" count={inbox.deadlines.length}>
              {inbox.deadlines.map(({ opp, days }) => (
                <Row
                  key={opp.id}
                  icon={KanbanSquare}
                  title={`${opp.company} — ${opp.role}`}
                  subtitle={deadlinePhrase(days, opp.deadline!)}
                  urgent={days <= 1}
                  onOpen={() => navigate(ROUTES.pipeline)}
                  action={
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={ROUTES.pipeline}>Open</Link>
                    </Button>
                  }
                />
              ))}
            </Section>
          )}

          {inbox.keyDates.length > 0 && (
            <Section icon={Gift} title="Dates to remember" count={inbox.keyDates.length}>
              {inbox.keyDates.map(({ keyDate, contact, days }) => (
                <Row
                  key={keyDate.id}
                  contact={contact}
                  icon={Gift}
                  title={contact ? `${fullName(contact)} · ${keyDate.label}` : keyDate.label}
                  subtitle={days === 0 ? 'Today — send a note' : 'Tomorrow'}
                  onOpen={contact ? () => navigate(ROUTES.contact(contact.id)) : undefined}
                />
              ))}
            </Section>
          )}

          {inbox.reconnect.length > 0 && (
            <Section
              icon={AlarmClock}
              title="Overdue to reconnect"
              count={inbox.reconnectTotal}
              more={
                inbox.reconnectTotal > inbox.reconnect.length ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={ROUTES.contactsOverdue}>See all {inbox.reconnectTotal}</Link>
                  </Button>
                ) : undefined
              }
            >
              {inbox.reconnect.map((contact) => (
                <Row
                  key={contact.id}
                  contact={contact}
                  icon={AlarmClock}
                  title={fullName(contact)}
                  subtitle={[contact.company, getReconnectStatus(contact).reason]
                    .filter(Boolean)
                    .join(' · ')}
                  onOpen={() => navigate(ROUTES.contact(contact.id))}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      title={`Caught up with ${fullName(contact)}`}
                      aria-label={`Caught up with ${fullName(contact)}`}
                      onClick={() => void markCaughtUp(contact)}
                    >
                      <Check />
                      <span className="hidden sm:inline">Caught up</span>
                    </Button>
                  }
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <MeetingNotesDialog
        open={Boolean(notesFor)}
        onOpenChange={(open) => !open && setNotesFor(null)}
        event={notesFor}
      />
    </PageShell>
  )
}

function deadlinePhrase(days: number, deadline: string): string {
  const date = format(parseISO(deadline), 'MMM d')
  if (days < 0) return `Deadline passed ${-days === 1 ? 'yesterday' : `${-days} days ago`} (${date})`
  if (days === 0) return `Due today (${date})`
  if (days === 1) return `Due tomorrow (${date})`
  return `Due in ${days} days (${date})`
}

function Section({
  icon: Icon,
  title,
  count,
  more,
  children,
}: {
  icon: LucideIcon
  title: string
  count: number
  more?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Panel>
      <PanelHeader action={more}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          <span className="tnum rounded-full bg-bg-sunken px-1.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        </span>
      </PanelHeader>
      <ul>{children}</ul>
    </Panel>
  )
}

function Row({
  contact,
  icon: Icon,
  title,
  subtitle,
  urgent,
  onOpen,
  action,
}: {
  contact?: Contact
  icon: LucideIcon
  title: string
  subtitle?: string
  urgent?: boolean
  onOpen?: () => void
  action?: React.ReactNode
}) {
  const body = (
    <>
      {contact ? (
        <ContactAvatar contact={contact} className="h-7 w-7 shrink-0" />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-bg-sunken text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{title}</span>
        {subtitle && (
          <span className={urgent ? 'block truncate text-xs text-danger' : 'block truncate text-xs text-muted-foreground'}>
            {subtitle}
          </span>
        )}
      </span>
    </>
  )

  return (
    <li className="flex items-center gap-2 border-b px-4 last:border-b-0 hover:bg-accent/40">
      {onOpen ? (
        <button
          onClick={onOpen}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 text-left focus-visible:outline-none"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2">{body}</div>
      )}
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </li>
  )
}

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {[0, 1].map((i) => (
        <Panel key={i}>
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex h-12 items-center gap-3 border-b px-4 last:border-b-0">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-56" />
            </div>
          ))}
        </Panel>
      ))}
    </div>
  )
}
