import { contactRepo, eventRepo } from '@/services'
import type { CalendarEvent, Contact } from '@/types'

/**
 * How a meeting reads on each attendee's timeline: the title, and the notes
 * after it once there are any. The one place this format lives, because
 * saving notes later has to find the entry it wrote earlier.
 */
export function meetingSummary(title: string, notes?: string): string {
  const trimmed = notes?.trim()
  return trimmed ? `${title} — ${trimmed}` : title
}

/** The date a meeting is logged under on a timeline. */
export function meetingLogDate(event: CalendarEvent): string {
  return event.startsAt.slice(0, 10)
}

/** A meeting that has started, so there's something to write up. */
export function hasStarted(event: CalendarEvent, now = Date.now()): boolean {
  return new Date(event.startsAt).getTime() <= now
}

/**
 * Save post-meeting notes, and — if the meeting has already been logged to
 * the attendees' timelines — carry the notes onto those entries too, so the
 * write-up shows on each person's profile rather than only on the calendar.
 */
export async function saveMeetingNotes(
  event: CalendarEvent,
  notes: string,
  contacts: Contact[],
): Promise<void> {
  const trimmed = notes.trim()
  await eventRepo.update(event.id, { notes: trimmed })

  if (!event.logged || event.contactIds.length === 0) return

  const date = meetingLogDate(event)
  const before = meetingSummary(event.title, event.notes)
  const after = meetingSummary(event.title, trimmed)
  if (before === after) return

  for (const contactId of event.contactIds) {
    const contact = contacts.find((c) => c.id === contactId)
    const entry = contact?.interactions.find(
      (i) => i.type === 'meeting' && i.date === date && i.summary === before,
    )
    if (!entry) continue
    try {
      await contactRepo.updateInteraction(contactId, entry.id, { summary: after })
    } catch (err) {
      console.error('Could not copy meeting notes to contact', contactId, err)
    }
  }
}
