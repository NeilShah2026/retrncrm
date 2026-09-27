import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useIsMobile } from '@/hooks/useIsMobile'
import { isNative } from '@/lib/platform'
import { createId } from '@/lib/utils'
import type { ColdSend, ColdTarget, Interaction } from '@/types'
import type { ContactDraft } from '@/services/types'

/**
 * Cold email: the rules, with no React or database attached, so the page, the
 * Inbox and the reasoning here all agree about where each target stands.
 *
 * ⚠️ The extension keeps its own copy of `FOLLOW_UP_GAPS` and
 * `nextFollowUpAfter` (extension/src/cold.ts), since it can't import from the
 * web app. A change to the schedule belongs in both.
 */

/**
 * Days to wait before each follow-up, counted from the send before it.
 *
 * Five days gives someone a working week to answer; the second nudge comes a
 * week after the first. Two follow-ups and then stop: past that it reads as
 * pressure rather than persistence. Counting from the previous send (not the
 * first) keeps the gap sensible when a follow-up goes out late.
 */
export const FOLLOW_UP_GAPS = [5, 7] as const

/** After the last follow-up, how long to wait before calling it "no reply". */
export const NO_REPLY_AFTER_DAYS = 7

const ISO = 'yyyy-MM-dd'

export function todayIso(now: Date = new Date()): string {
  return format(now, ISO)
}

export function targetName(t: Pick<ColdTarget, 'firstName' | 'lastName' | 'email'>): string {
  return `${t.firstName} ${t.lastName}`.trim() || t.email || 'Unnamed'
}

/** Oldest first, whatever order they were written in. */
export function sortedSends(sends: ColdSend[]): ColdSend[] {
  return [...sends].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

/**
 * When to follow up, given everything sent so far: the gap after the latest
 * send, or nothing once both follow-ups have gone.
 */
export function nextFollowUpAfter(sends: ColdSend[]): string | undefined {
  if (sends.length === 0) return undefined
  const gap = FOLLOW_UP_GAPS[sends.length - 1]
  if (gap === undefined) return undefined
  const last = sortedSends(sends)[sends.length - 1]
  return format(addDays(parseISO(last.date), gap), ISO)
}

/**
 * The patch that records one more email going out. Also reopens a target
 * that had been closed — sending to them again means they're back in play.
 */
export function withSend(
  target: Pick<ColdTarget, 'sends' | 'status'>,
  send: { date: string; subject?: string; body?: string; link?: string },
): Pick<ColdTarget, 'sends' | 'status' | 'nextFollowUp'> {
  const entry: ColdSend = {
    id: createId(),
    date: send.date,
    subject: send.subject?.trim() || undefined,
    body: send.body?.trim() || undefined,
    link: send.link,
    createdAt: new Date().toISOString(),
  }
  const sends = sortedSends([...target.sends, entry])
  // A reply or a conversion outranks another send; everything else is "sent".
  const status = target.status === 'replied' || target.status === 'converted' ? target.status : 'sent'
  return { sends, status, nextFollowUp: status === 'sent' ? nextFollowUpAfter(sends) : undefined }
}

/** Where a target stands, as the page and the Inbox show it. */
export type ColdStage = 'drafting' | 'due' | 'waiting' | 'no-reply' | 'replied' | 'converted' | 'closed'

export const COLD_STAGES: Record<
  ColdStage,
  { label: string; tone: 'secondary' | 'outline' | 'warning' | 'success' | 'info' | 'destructive' }
> = {
  due: { label: 'Follow up', tone: 'warning' },
  waiting: { label: 'Waiting', tone: 'outline' },
  drafting: { label: 'Drafting', tone: 'secondary' },
  replied: { label: 'Replied', tone: 'success' },
  'no-reply': { label: 'No reply', tone: 'secondary' },
  converted: { label: 'Contact', tone: 'info' },
  closed: { label: 'Closed', tone: 'secondary' },
}

/** The order the filter lists them in: what needs you first. */
export const COLD_STAGE_ORDER: ColdStage[] = [
  'due',
  'waiting',
  'drafting',
  'replied',
  'no-reply',
  'converted',
  'closed',
]

export function coldStage(t: ColdTarget, now: Date = new Date()): ColdStage {
  switch (t.status) {
    case 'drafting':
    case 'replied':
    case 'converted':
    case 'closed':
      return t.status
    case 'sent': {
      const today = todayIso(now)
      if (t.nextFollowUp) return t.nextFollowUp <= today ? 'due' : 'waiting'
      // Out of follow-ups: give the last one a week before calling it.
      const last = sortedSends(t.sends).at(-1)
      if (!last) return 'waiting'
      return differenceInCalendarDays(now, parseISO(last.date)) >= NO_REPLY_AFTER_DAYS
        ? 'no-reply'
        : 'waiting'
    }
  }
}

/** "Follow-up 1 of 2" — which nudge is next, for the row and the detail. */
export function followUpOrdinal(t: Pick<ColdTarget, 'sends'>): string | null {
  const n = t.sends.length
  if (n === 0 || n > FOLLOW_UP_GAPS.length) return null
  return `Follow-up ${n} of ${FOLLOW_UP_GAPS.length}`
}

/** "Today", "Tomorrow", "In 4 days", "3 days late" — relative to now. */
export function describeFollowUp(date: string, now: Date = new Date()): string {
  const days = differenceInCalendarDays(parseISO(date), now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 1) return `In ${days} days`
  return days === -1 ? '1 day late' : `${-days} days late`
}

/** A short date, "Oct 2", for tables. */
export function shortDate(date: string): string {
  return format(parseISO(date), 'MMM d')
}

/** The targets whose follow-up is due, soonest-overdue first. */
export function dueTargets(targets: ColdTarget[], now: Date = new Date()): ColdTarget[] {
  return targets
    .filter((t) => coldStage(t, now) === 'due')
    .sort((a, b) => (a.nextFollowUp ?? '').localeCompare(b.nextFollowUp ?? ''))
}

/**
 * The contact a target becomes. Every email sent goes with them as an
 * interaction, so the contact's timeline starts where the conversation did.
 */
export function toContactDraft(t: ColdTarget, now: Date = new Date()): ContactDraft {
  const sends = sortedSends(t.sends)
  const interactions: Interaction[] = sends.map((s, i) => ({
    id: createId(),
    date: s.date,
    type: 'email',
    summary: `${i === 0 ? 'Cold email' : `Follow-up ${i}`}${s.subject ? `: ${s.subject}` : ''}`,
    link: s.link,
    createdAt: s.createdAt,
  }))
  const replied = t.repliedAt ? t.repliedAt.slice(0, 10) : undefined
  return {
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email,
    company: t.company,
    jobTitle: t.role,
    linkedinUrl: t.linkedinUrl,
    otherLinks: [],
    source: 'online',
    howWeMet: 'Cold email',
    // They're a contact because they wrote back — that's the day you met.
    dateMet: replied ?? todayIso(now),
    notes: [t.hook && `Why I reached out: ${t.hook}`, t.notes].filter(Boolean).join('\n\n') || undefined,
    tagIds: [],
    relationshipStrength: 2,
    lastContactDate: replied,
    contactFrequencyGoal: 'none',
    interactions,
  }
}

/**
 * Only on a computer. Cold emails get written and sent from a laptop, and the
 * page is a table beside an editor, which doesn't survive a phone's width —
 * so it's absent from the iPhone app and from anything below the desktop
 * layout, the same breakpoint that swaps the sidebar for the tab bar.
 */
export function useColdEmailAvailable(): boolean {
  const isMobile = useIsMobile()
  return !isNative && !isMobile
}

/** Gmail's compose window, pre-filled. Nothing is sent until they press Send. */
export function gmailComposeUrl({ to, subject, body }: { to?: string; subject?: string; body?: string }): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1' })
  if (to) params.set('to', to)
  if (subject) params.set('su', subject)
  if (body) params.set('body', body)
  return `https://mail.google.com/mail/?${params.toString()}`
}

/** The same for whatever mail app the computer has. */
export function mailtoUrl({ to, subject, body }: { to?: string; subject?: string; body?: string }): string {
  const params: string[] = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  return `mailto:${to ? encodeURIComponent(to) : ''}${params.length ? `?${params.join('&')}` : ''}`
}
