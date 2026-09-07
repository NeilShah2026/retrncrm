import { getReconnectStatus } from '@/lib/reconnect'
import { daysSince } from '@/lib/format'
import type { CalendarEvent, Contact, Opportunity } from '@/types'

/** Every number a stat tile can show, counted once per render of the page. */
export interface DashboardStats {
  total: number
  meetingsThisWeek: number
  overdueCount: number
  openOpportunities: number
  addedThisMonth: number
  strongTies: number
}

/** A tie you'd actually ask for something. */
const STRONG_TIE_MIN = 4

export function computeDashboardStats(
  contacts: Contact[],
  events: CalendarEvent[],
  opportunities: Opportunity[],
): DashboardStats {
  // "This week" is the next seven days, not the calendar week — what's ahead
  // of you on a Friday shouldn't reset to zero on Monday.
  const meetingsThisWeek = events.filter((e) => {
    const days = daysSince(e.startsAt)
    return days !== null && days <= 0 && days >= -7
  }).length

  const thisMonth = new Date().toISOString().slice(0, 7)

  return {
    total: contacts.length,
    meetingsThisWeek,
    overdueCount: contacts.filter((c) => getReconnectStatus(c).overdue).length,
    openOpportunities: opportunities.filter((o) => o.stage !== 'closed').length,
    addedThisMonth: contacts.filter((c) => c.createdAt.startsWith(thisMonth)).length,
    strongTies: contacts.filter((c) => c.relationshipStrength >= STRONG_TIE_MIN).length,
  }
}
