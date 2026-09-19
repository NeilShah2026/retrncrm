import * as React from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import {
  useContacts,
  useEvents,
  useFollowUps,
  useKeyDates,
  useOpportunities,
} from '@/hooks/useData'
import { isDue } from '@/lib/followUps'
import { upcomingKeyDates } from '@/lib/keyDates'
import { getReconnectStatus } from '@/lib/reconnect'
import type { CalendarEvent, Contact, FollowUp, KeyDate, Opportunity } from '@/types'

/**
 * The Inbox: everything that is waiting on you, in one list. Nothing here is
 * stored — each item is derived from records that already exist, so it clears
 * itself the moment the underlying thing is done (the follow-up ticked, the
 * notes written, the application moved on).
 */

/** Meetings this recent that have no notes yet are worth writing up. */
const NOTES_WINDOW_DAYS = 14
/** Deadlines this close (or this recently missed) are outstanding. */
const DEADLINE_AHEAD_DAYS = 7
const DEADLINE_BEHIND_DAYS = 14
/** Birthdays and anniversaries today or tomorrow. */
const KEY_DATE_DAYS = 1
/** The longest-overdue people; the rest live on the Contacts filter. */
const MAX_RECONNECT = 5

export interface Inbox {
  followUps: { followUp: FollowUp; contact?: Contact }[]
  meetings: { event: CalendarEvent; attendees: Contact[] }[]
  deadlines: { opp: Opportunity; days: number }[]
  keyDates: { keyDate: KeyDate; contact?: Contact; days: number }[]
  reconnect: Contact[]
  /** Everyone overdue, not just the few listed. */
  reconnectTotal: number
  /** Items shown, for the nav badge. */
  count: number
  ready: boolean
}

// --- Meetings the user chose not to write up --------------------------------

const SKIPPED_KEY = 'retrn-inbox-skipped-notes'

function readSkipped(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

const skippedListeners = new Set<() => void>()

/** "Nothing to note" for a meeting: drop it from the Inbox on this device. */
export function skipMeetingNotes(eventId: string): void {
  const next = readSkipped()
  next.add(eventId)
  try {
    // Only recent meetings are ever listed, so old ids can go.
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...next].slice(-200)))
  } catch {
    // Private mode: it just comes back next visit.
  }
  skippedListeners.forEach((fn) => fn())
}

/** Forget which meetings were skipped — on sign-out; they're per account. */
export function clearSkippedMeetingNotes(): void {
  try {
    localStorage.removeItem(SKIPPED_KEY)
  } catch {
    // Nothing stored, or storage is unavailable.
  }
  skippedListeners.forEach((fn) => fn())
}

function useSkipped(): Set<string> {
  const [skipped, setSkipped] = React.useState(readSkipped)
  React.useEffect(() => {
    const update = () => setSkipped(readSkipped())
    skippedListeners.add(update)
    return () => {
      skippedListeners.delete(update)
    }
  }, [])
  return skipped
}

// --- Building it -------------------------------------------------------------

export function buildInbox(
  data: {
    contacts: Contact[]
    followUps: FollowUp[]
    events: CalendarEvent[]
    opportunities: Opportunity[]
    keyDates: KeyDate[]
  },
  skipped: Set<string> = new Set(),
  now: Date = new Date(),
): Omit<Inbox, 'ready'> {
  const contactMap = new Map(data.contacts.map((c) => [c.id, c]))

  const followUps = data.followUps
    .filter((f) => isDue(f, now))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((followUp) => ({ followUp, contact: contactMap.get(followUp.contactId) }))

  const meetings = data.events
    .filter((e) => {
      if (e.notes?.trim() || skipped.has(e.id)) return false
      const end = parseISO(e.endsAt)
      return end <= now && differenceInCalendarDays(now, end) <= NOTES_WINDOW_DAYS
    })
    .sort((a, b) => b.endsAt.localeCompare(a.endsAt))
    .map((event) => ({
      event,
      attendees: event.contactIds
        .map((id) => contactMap.get(id))
        .filter((c): c is Contact => Boolean(c)),
    }))

  const deadlines = data.opportunities
    .filter((o) => o.stage !== 'closed' && o.deadline)
    .map((opp) => ({ opp, days: differenceInCalendarDays(parseISO(opp.deadline!), now) }))
    // Once applied, the deadline no longer asks anything of you.
    .filter(({ opp, days }) => !opp.appliedDate && days <= DEADLINE_AHEAD_DAYS && days >= -DEADLINE_BEHIND_DAYS)
    .sort((a, b) => a.days - b.days)

  const keyDates = upcomingKeyDates(data.keyDates, KEY_DATE_DAYS, now).map(({ keyDate, days }) => ({
    keyDate,
    days,
    contact: contactMap.get(keyDate.contactId),
  }))

  // Someone with a follow-up already listed doesn't need a second nudge.
  const listed = new Set(followUps.map((f) => f.followUp.contactId))
  const overdue = data.contacts
    .filter((c) => !listed.has(c.id))
    .map((contact) => ({ contact, status: getReconnectStatus(contact) }))
    .filter(({ status }) => status.overdue)
    .sort((a, b) => (b.status.overdueBy ?? 0) - (a.status.overdueBy ?? 0))
  const reconnect = overdue.slice(0, MAX_RECONNECT).map(({ contact }) => contact)

  return {
    followUps,
    meetings,
    deadlines,
    keyDates,
    reconnect,
    reconnectTotal: overdue.length,
    count:
      followUps.length + meetings.length + deadlines.length + keyDates.length + reconnect.length,
  }
}

/** The Inbox for the signed-in account, live. */
export function useInbox(): Inbox {
  const contacts = useContacts()
  const followUps = useFollowUps()
  const events = useEvents()
  const opportunities = useOpportunities()
  const keyDates = useKeyDates()
  const skipped = useSkipped()

  // Meetings move into "write it up" as they end, not only when data changes.
  const [minute, setMinute] = React.useState(0)
  React.useEffect(() => {
    const timer = window.setInterval(() => setMinute((m) => m + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return React.useMemo(() => {
    const inbox = buildInbox(
      {
        contacts: contacts ?? [],
        followUps: followUps ?? [],
        events: events ?? [],
        opportunities: opportunities ?? [],
        keyDates: keyDates ?? [],
      },
      skipped,
    )
    return { ...inbox, ready: Boolean(contacts && followUps && events && opportunities && keyDates) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` is the clock
  }, [contacts, followUps, events, opportunities, keyDates, skipped, minute])
}
