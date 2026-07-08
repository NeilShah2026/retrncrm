import type { Contact } from '@/types'
import { FREQUENCY_OPTIONS, STALE_CONTACT_DAYS } from './constants'
import { daysSince } from './format'

export interface ReconnectStatus {
  /** True if the contact is due/overdue for outreach. */
  overdue: boolean
  /** Days since last contact (or since dateMet if never contacted). */
  daysSinceContact: number | null
  /** The interval (days) implied by their frequency goal, if any. */
  goalDays: number | null
  /** How many days past the goal they are (>0 means overdue by this much). */
  overdueBy: number | null
  /** Human explanation, e.g. "Overdue by 24 days". */
  reason: string
}

/**
 * Determine whether a contact is due for reconnection. A contact is overdue if:
 *  - they have a frequency goal and time since last contact exceeds it, OR
 *  - they have no goal but haven't been contacted in STALE_CONTACT_DAYS.
 * "Last contact" falls back to when they were met if never explicitly logged.
 */
export function getReconnectStatus(contact: Contact): ReconnectStatus {
  const reference = contact.lastContactDate ?? contact.dateMet ?? null
  const daysSinceContact = daysSince(reference)
  const goalDays = FREQUENCY_OPTIONS[contact.contactFrequencyGoal]?.days ?? null

  if (daysSinceContact === null) {
    return {
      overdue: false,
      daysSinceContact: null,
      goalDays,
      overdueBy: null,
      reason: 'No contact history yet',
    }
  }

  if (goalDays !== null) {
    const overdueBy = daysSinceContact - goalDays
    if (overdueBy > 0) {
      return {
        overdue: true,
        daysSinceContact,
        goalDays,
        overdueBy,
        reason: `Overdue by ${overdueBy} ${overdueBy === 1 ? 'day' : 'days'}`,
      }
    }
    return {
      overdue: false,
      daysSinceContact,
      goalDays,
      overdueBy,
      reason: `On track · due in ${-overdueBy} ${-overdueBy === 1 ? 'day' : 'days'}`,
    }
  }

  // No explicit goal → use the stale threshold.
  if (daysSinceContact >= STALE_CONTACT_DAYS) {
    return {
      overdue: true,
      daysSinceContact,
      goalDays: null,
      overdueBy: daysSinceContact - STALE_CONTACT_DAYS,
      reason: `No contact in ${Math.round(daysSinceContact / 30)} months`,
    }
  }

  return {
    overdue: false,
    daysSinceContact,
    goalDays: null,
    overdueBy: null,
    reason: 'Recently in touch',
  }
}

export function isOverdue(contact: Contact): boolean {
  return getReconnectStatus(contact).overdue
}
