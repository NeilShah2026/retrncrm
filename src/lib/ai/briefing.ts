import { differenceInCalendarDays, format } from 'date-fns'
import { askClaudeJson, truncate } from './client'
import { getReconnectStatus } from '@/lib/reconnect'
import { CONNECTION_TYPES, OPPORTUNITY_STAGES } from '@/lib/constants'
import { fullName, daysSince } from '@/lib/format'
import { daysUntilKeyDate } from '@/lib/keyDates'
import type { CalendarEvent, Contact, FollowUp, KeyDate, Opportunity, Tag } from '@/types'

/**
 * "What should I actually do today?" — the dashboard's one list.
 *
 * Everything with a clock on it lives here, not in a panel of its own:
 * meetings this week, follow-ups due, people gone quiet, deadlines and
 * birthdays. The model gets a compact snapshot of all five and returns them
 * as one ordered list, each with the reason it made the cut.
 *
 * Two rules hold it to the same bargain as the rest of the AI here: every
 * action must point at a real record (the model answers with a reference into
 * the snapshot, never a name it typed), and if the model is unreachable
 * `localBriefing` produces the same shape from plain rules — so the section
 * is useful with AI switched off, just less pointed.
 */

export type BriefingKind = 'prep' | 'reconnect' | 'draft' | 'pipeline' | 'followup' | 'date'

export interface BriefingAction {
  kind: BriefingKind
  /** Imperative, one line: the thing to do. */
  title: string
  /** Why it made the list, grounded in the user's own records. */
  why: string
  contact?: Contact
  opportunity?: Opportunity
  event?: CalendarEvent
  followUp?: FollowUp
  keyDate?: KeyDate
}

export interface Briefing {
  headline: string
  actions: BriefingAction[]
  /** False when the local rules wrote it because the model was unavailable. */
  fromModel: boolean
}

/** The lists worth acting on, already trimmed to what fits a prompt. */
export interface NetworkSnapshot {
  people: Contact[]
  meetings: { event: CalendarEvent; attendees: Contact[] }[]
  opportunities: { opp: Opportunity; helpers: Contact[] }[]
  followUps: { followUp: FollowUp; contact: Contact }[]
  dates: { keyDate: KeyDate; contact: Contact }[]
  /** Nothing to brief on at all — the caller shows an empty state instead. */
  empty: boolean
}

const MAX_PEOPLE = 12
const MAX_MEETINGS = 8
const MAX_OPPS = 5
const MAX_FOLLOW_UPS = 8
const MAX_DATES = 5
/** The whole list fits the dashboard without scrolling. */
const MAX_ACTIONS = 8
/** Applications get a voice, but can't crowd out the people. */
const MAX_PIPELINE_ACTIONS = 2
/** "This week": meetings and birthdays further out aren't today's problem. */
const MEETING_HORIZON_DAYS = 7
const DATE_HORIZON_DAYS = 7
/** Follow-ups due within this many days (and every overdue one). */
const FOLLOW_UP_HORIZON_DAYS = 2
const DEADLINE_HORIZON_DAYS = 30

/**
 * Calendar days from today until an ISO date or datetime, in the user's own
 * timezone (negative = already past). "Today" means the same date on the
 * wall calendar — not "less than 24 hours away", which called a meeting at
 * 5pm "tomorrow" at 3pm, and a bare yyyy-mm-dd read as UTC midnight lands on
 * the previous day anywhere west of London.
 */
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return differenceInCalendarDays(date, new Date())
}

/** A meeting counts until it has ended — not once it has merely started. */
function isOver(event: CalendarEvent, now = Date.now()): boolean {
  return new Date(event.endsAt).getTime() <= now
}

function whenPhrase(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 0) return `${-days} days ago`
  return `in ${days} days`
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/** How much this person is asking to be dealt with right now. */
function reconnectPriority(contact: Contact): number {
  const status = getReconnectStatus(contact)
  if (!status.overdue) return 0
  // Overdue-ness matters, but a close contact slipping matters more than an
  // acquaintance you met once — and 400 days overdue isn't 10x worse than 40.
  const lateness = Math.min(status.overdueBy ?? 0, 180) / 180
  return lateness * 2 + contact.relationshipStrength / 5
}

export function buildSnapshot(
  contacts: Contact[],
  opportunities: Opportunity[],
  events: CalendarEvent[],
  followUps: FollowUp[] = [],
  keyDates: KeyDate[] = [],
): NetworkSnapshot {
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const dueFollowUps = followUps
    .filter((f) => !f.completedAt && contactMap.has(f.contactId))
    .filter((f) => (daysUntil(f.dueDate) ?? 999) <= FOLLOW_UP_HORIZON_DAYS)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, MAX_FOLLOW_UPS)
    .map((followUp) => ({ followUp, contact: contactMap.get(followUp.contactId)! }))

  const dates = keyDates
    .filter((k) => contactMap.has(k.contactId))
    .map((keyDate) => ({ keyDate, days: daysUntilKeyDate(keyDate) }))
    .filter(({ days }) => days <= DATE_HORIZON_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, MAX_DATES)
    .map(({ keyDate }) => ({ keyDate, contact: contactMap.get(keyDate.contactId)! }))

  const now = Date.now()
  const meetings = events
    .filter((event) => !isOver(event, now))
    .map((event) => ({ event, days: daysUntil(event.startsAt) ?? 999 }))
    .filter(({ days }) => days >= 0 && days <= MEETING_HORIZON_DAYS)
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
    .slice(0, MAX_MEETINGS)
    .map(({ event }) => ({
      event,
      attendees: event.contactIds
        .map((id) => contactMap.get(id))
        .filter((c): c is Contact => Boolean(c)),
    }))

  // Someone you're about to sit down with — or already owe a follow-up —
  // doesn't also belong on the "gone quiet" list: that is the action.
  const scheduled = new Set([
    ...meetings.flatMap((m) => m.event.contactIds),
    ...dueFollowUps.map((f) => f.contact.id),
  ])

  const people = contacts
    .filter((c) => !scheduled.has(c.id))
    .map((contact) => ({ contact, score: reconnectPriority(contact) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PEOPLE)
    .map(({ contact }) => contact)

  const opps = opportunities
    .filter((o) => {
      if (o.stage === 'closed') return false
      const untilDeadline = daysUntil(o.deadline)
      if (
        untilDeadline !== null &&
        untilDeadline >= -7 &&
        untilDeadline <= DEADLINE_HORIZON_DAYS
      ) {
        return true
      }
      // An application that went quiet is worth a nudge even with no deadline.
      const sinceApplied = daysSince(o.appliedDate)
      return o.stage !== 'researching' && sinceApplied !== null && sinceApplied >= 14
    })
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    .slice(0, MAX_OPPS)
    .map((opp) => ({
      opp,
      helpers: opp.contactIds
        .map((id) => contactMap.get(id))
        .filter((c): c is Contact => Boolean(c)),
    }))

  return {
    people,
    meetings,
    opportunities: opps,
    followUps: dueFollowUps,
    dates,
    empty:
      people.length === 0 &&
      meetings.length === 0 &&
      opps.length === 0 &&
      dueFollowUps.length === 0 &&
      dates.length === 0,
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function personLine(contact: Contact, index: number, tagMap: Map<string, Tag>): string {
  const parts: string[] = [`P${index}. ${fullName(contact)}`]
  const role = [contact.jobTitle, contact.company].filter(Boolean).join(' at ')
  if (role) parts.push(role)
  if (contact.connectionType) parts.push(CONNECTION_TYPES[contact.connectionType].label)
  if (contact.school) parts.push(contact.school)

  const status = getReconnectStatus(contact)
  parts.push(
    contact.lastContactDate
      ? `last spoke ${whenPhrase(daysUntil(contact.lastContactDate) ?? 0)} (${status.reason})`
      : `never followed up since meeting (${status.reason})`,
  )
  parts.push(`closeness ${contact.relationshipStrength}/5`)

  const tags = contact.tagIds
    .map((id) => tagMap.get(id)?.name)
    .filter(Boolean)
    .join(', ')
  if (tags) parts.push(`tags: ${tags}`)

  const context = truncate(
    [contact.howWeMet, contact.whereWeMet, contact.talkingPoints, contact.notes]
      .filter(Boolean)
      .join('. '),
    140,
  )
  if (context) parts.push(context)
  return parts.join(' | ')
}

function meetingLine(
  { event, attendees }: NetworkSnapshot['meetings'][number],
  index: number,
): string {
  const parts: string[] = [`M${index}. "${truncate(event.title, 80)}"`]
  // The exact local day and time as well as the relative phrase, so the model
  // never has to work out which day "in 2 days" is.
  const start = new Date(event.startsAt)
  const when = event.allDay ? format(start, 'EEE MMM d') : format(start, 'EEE MMM d, h:mm a')
  parts.push(`${when} (${whenPhrase(daysUntil(event.startsAt) ?? 0)})`)
  if (attendees.length) parts.push(`with ${attendees.map(fullName).join(', ')}`)
  if (event.location) parts.push(truncate(event.location, 60))

  // Whether there's anything to walk in with is the whole reason to prep.
  if (attendees.length && !attendees.some((c) => c.talkingPoints?.trim())) {
    parts.push('no talking points saved yet')
  }
  const notes = truncate(event.description, 100)
  if (notes) parts.push(notes)
  return parts.join(' | ')
}

function opportunityLine(
  { opp, helpers }: NetworkSnapshot['opportunities'][number],
  index: number,
): string {
  const parts: string[] = [`O${index}. ${opp.company} — ${opp.role}`]
  parts.push(OPPORTUNITY_STAGES[opp.stage].label)

  const untilDeadline = daysUntil(opp.deadline)
  if (untilDeadline !== null) parts.push(`deadline ${whenPhrase(untilDeadline)}`)
  const sinceApplied = daysSince(opp.appliedDate)
  if (sinceApplied !== null) parts.push(`applied ${sinceApplied} days ago`)

  parts.push(
    helpers.length
      ? `contacts who can help: ${helpers.map(fullName).join(', ')}`
      : 'no contact linked',
  )
  return parts.join(' | ')
}

function followUpLine({ followUp, contact }: NetworkSnapshot['followUps'][number], index: number): string {
  const days = daysUntil(followUp.dueDate) ?? 0
  const due = days < 0 ? `overdue by ${-days} days` : `due ${whenPhrase(days)}`
  const what = truncate(followUp.note, 100) || 'follow up'
  return `F${index}. ${fullName(contact)} | ${what} | ${due}`
}

function dateLine({ keyDate, contact }: NetworkSnapshot['dates'][number], index: number): string {
  const days = daysUntilKeyDate(keyDate)
  return `B${index}. ${fullName(contact)}'s ${keyDate.label.toLowerCase()} | ${whenPhrase(days)}`
}

const SYSTEM = `You are the morning briefing for someone's personal CRM. They \
are a student or early-career professional keeping track of people they've met.

You are given lists from their own records: meetings this week (M), \
follow-ups they promised (F), people they have gone quiet on (P), job \
applications in flight (O), and birthdays or other yearly dates this week (B).

Reply with a single JSON object and nothing else:
{"headline": "one short sentence", "actions": [{"ref": "P3", "kind": "reconnect", "do": "…", "why": "…"}]}

Rules:
- "ref" must be an id that appears in the lists above. Never invent a person, \
a meeting, or a company, and never reference the same one twice.
- "kind" is one of: "prep" (get ready for a meeting), "followup" (do the \
thing they promised), "reconnect" (reach out to someone who has gone quiet), \
"draft" (write a specific message), "pipeline" (act on an application), \
"date" (a birthday or yearly date to acknowledge).
- This is their whole to-do list for the next few days, so include every \
meeting, every follow-up and every date given, plus the people and \
applications most worth acting on. At most ${MAX_ACTIONS} actions and at most \
${MAX_PIPELINE_ACTIONS} "pipeline" actions, most urgent first. Overdue \
follow-ups and meetings today come first.
- "do" is an imperative under 8 words: "Prep for coffee with Dana Cruz".
- "why" is under 12 words citing the one fact that made it urgent. Never \
restate "do". For a meeting, use the day exactly as given in the list \
("today", "tomorrow", "Tue Sep 22") — never work out a day yourself.
- "headline" is under 12 words and states the shape of the day. No \
greeting, no pep talk, no exclamation marks.
- These records are all you know. Do not use outside knowledge about any \
company or person.`

interface RawAction {
  ref?: unknown
  kind?: unknown
  do?: unknown
  why?: unknown
}

interface RawBriefing {
  headline?: unknown
  actions?: unknown
}

const KINDS: BriefingKind[] = ['prep', 'reconnect', 'draft', 'pipeline', 'followup', 'date']

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * A briefing costs a request, and the dashboard is the page people land on
 * most — so the raw answer is cached against a fingerprint of exactly the
 * facts that went into it. Add a contact, catch up with someone, or let the
 * day roll over and the fingerprint changes on its own.
 */
const CACHE_KEY = 'retrn-briefing-cache'

export function snapshotFingerprint(snapshot: NetworkSnapshot): string {
  const parts = [
    new Date().toISOString().slice(0, 10),
    ...snapshot.people.map((c) => `p${c.id}:${c.lastContactDate ?? ''}`),
    ...snapshot.meetings.map((m) => `m${m.event.id}:${m.event.startsAt}`),
    ...snapshot.opportunities.map(
      ({ opp }) => `o${opp.id}:${opp.stage}:${opp.deadline ?? ''}`,
    ),
    ...snapshot.followUps.map(({ followUp }) => `f${followUp.id}:${followUp.dueDate}`),
    ...snapshot.dates.map(({ keyDate }) => `b${keyDate.id}`),
  ]
  const joined = parts.join('|')
  let hash = 0
  for (let i = 0; i < joined.length; i++) {
    hash = (hash * 31 + joined.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

/** Drop the cached briefing — on sign-out, so it can't leak across accounts. */
export function clearBriefingCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // Nothing cached, or storage is unavailable.
  }
}

function readCache(fingerprint: string): RawBriefing | null {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { fingerprint?: string; raw?: RawBriefing }
    return parsed.fingerprint === fingerprint ? (parsed.raw ?? null) : null
  } catch {
    return null
  }
}

function writeCache(fingerprint: string, raw: RawBriefing): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ fingerprint, raw }))
  } catch {
    // Private mode, or a full quota. A briefing is not worth failing over.
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Resolve the model's references back to the real records they must point at. */
function resolve(raw: RawBriefing, snapshot: NetworkSnapshot): Briefing {
  const actions: BriefingAction[] = []
  const seen = new Set<string>()
  let pipeline = 0

  for (const entry of Array.isArray(raw.actions) ? raw.actions : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const { ref, kind, do: title, why } = entry as RawAction
    if (typeof ref !== 'string' || typeof title !== 'string' || !title.trim()) continue

    const match = /^([PMOFB])(\d+)$/i.exec(ref.trim())
    if (!match) continue
    const list = match[1].toUpperCase()
    const index = Number(match[2]) - 1
    if (seen.has(ref.toUpperCase())) continue

    const action: BriefingAction = {
      kind: KINDS.includes(kind as BriefingKind) ? (kind as BriefingKind) : 'reconnect',
      title: truncate(title, 80),
      why: typeof why === 'string' ? truncate(why, 160) : '',
    }

    if (list === 'P') {
      const contact = snapshot.people[index]
      if (!contact) continue
      action.contact = contact
    } else if (list === 'M') {
      const meeting = snapshot.meetings[index]
      if (!meeting) continue
      action.event = meeting.event
      action.contact = meeting.attendees[0]
      if (action.kind === 'reconnect') action.kind = 'prep'
    } else if (list === 'F') {
      const entry = snapshot.followUps[index]
      if (!entry) continue
      action.followUp = entry.followUp
      action.contact = entry.contact
      action.kind = 'followup'
    } else if (list === 'B') {
      const entry = snapshot.dates[index]
      if (!entry) continue
      action.keyDate = entry.keyDate
      action.contact = entry.contact
      action.kind = 'date'
    } else {
      const entry = snapshot.opportunities[index]
      if (!entry || pipeline >= MAX_PIPELINE_ACTIONS) continue
      action.opportunity = entry.opp
      action.kind = 'pipeline'
      pipeline++
    }

    seen.add(ref.toUpperCase())
    actions.push(action)
    if (actions.length >= MAX_ACTIONS) break
  }

  // An answer that resolved to nothing is not an answer — fall back rather
  // than show a headline with no actions under it.
  if (actions.length === 0) return localBriefing(snapshot)

  const headline =
    typeof raw.headline === 'string' && raw.headline.trim()
      ? truncate(raw.headline, 200)
      : localHeadline(snapshot)

  return { headline, actions, fromModel: true }
}

export async function generateBriefing(
  snapshot: NetworkSnapshot,
  tagMap: Map<string, Tag>,
  options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<Briefing> {
  if (snapshot.empty) return localBriefing(snapshot)

  const fingerprint = snapshotFingerprint(snapshot)
  if (!options.force) {
    const cached = readCache(fingerprint)
    if (cached) return resolve(cached, snapshot)
  }

  const sections: string[] = []
  if (snapshot.meetings.length) {
    sections.push(
      `Meetings coming up:\n${snapshot.meetings
        .map((m, i) => meetingLine(m, i + 1))
        .join('\n')}`,
    )
  }
  if (snapshot.people.length) {
    sections.push(
      `People you have gone quiet on:\n${snapshot.people
        .map((c, i) => personLine(c, i + 1, tagMap))
        .join('\n')}`,
    )
  }
  if (snapshot.opportunities.length) {
    sections.push(
      `Applications in flight:\n${snapshot.opportunities
        .map((o, i) => opportunityLine(o, i + 1))
        .join('\n')}`,
    )
  }
  if (snapshot.followUps.length) {
    sections.push(
      `Follow-ups they promised:\n${snapshot.followUps.map((f, i) => followUpLine(f, i + 1)).join('\n')}`,
    )
  }
  if (snapshot.dates.length) {
    sections.push(
      `Dates this week:\n${snapshot.dates.map((d, i) => dateLine(d, i + 1)).join('\n')}`,
    )
  }

  const now = format(new Date(), "EEEE, MMM d, h:mm a")
  const raw = await askClaudeJson<RawBriefing>({
    system: SYSTEM,
    maxTokens: 900,
    signal: options.signal,
    // Built when the dashboard loads, so it never asks for AI permission —
    // the rules-based list stands in until the account has given it. The
    // refresh button (`force`) is a tap, so that one may ask.
    background: !options.force,
    messages: [{ role: 'user', content: `It is now ${now}.\n\n${sections.join('\n\n')}` }],
  })

  writeCache(fingerprint, raw)
  return resolve(raw, snapshot)
}

/**
 * The same briefing with everything already dealt with dropped, and the rest
 * re-pointed at the current records.
 *
 * Acting on a briefing changes the data the briefing was built from — tap
 * "caught up" and that person stops being overdue. Regenerating on every tap
 * would spend a request per tap, so the card prunes instead and only pays for
 * a new briefing once the list is empty (or the user asks for one).
 */
export function pruneBriefing(briefing: Briefing, snapshot: NetworkSnapshot): Briefing {
  const people = new Map(snapshot.people.map((c) => [c.id, c] as const))
  const attendees = new Map(
    snapshot.meetings.flatMap((m) => m.attendees.map((c) => [c.id, c] as const)),
  )
  const meetings = new Map(snapshot.meetings.map((m) => [m.event.id, m.event] as const))
  const opps = new Map(snapshot.opportunities.map(({ opp }) => [opp.id, opp] as const))
  const followUps = new Map(snapshot.followUps.map((f) => [f.followUp.id, f] as const))
  const dates = new Map(snapshot.dates.map((d) => [d.keyDate.id, d] as const))

  const actions = briefing.actions.flatMap((action): BriefingAction[] => {
    if (action.followUp) {
      const entry = followUps.get(action.followUp.id)
      return entry ? [{ ...action, followUp: entry.followUp, contact: entry.contact }] : []
    }
    if (action.keyDate) {
      const entry = dates.get(action.keyDate.id)
      return entry ? [{ ...action, keyDate: entry.keyDate, contact: entry.contact }] : []
    }
    if (action.event) {
      const event = meetings.get(action.event.id)
      if (!event || isOver(event)) return []
      const contact = action.contact
        ? (attendees.get(action.contact.id) ?? action.contact)
        : undefined
      return [{ ...action, event, contact }]
    }
    if (action.opportunity) {
      const opportunity = opps.get(action.opportunity.id)
      return opportunity ? [{ ...action, opportunity }] : []
    }
    if (action.contact) {
      const contact = people.get(action.contact.id)
      return contact ? [{ ...action, contact }] : []
    }
    return []
  })

  return { ...briefing, actions }
}

// ---------------------------------------------------------------------------
// The non-AI path
// ---------------------------------------------------------------------------

/**
 * The same list, written by rules: everything scored by how soon it needs
 * you, then the people who have waited longest. Roughly the order the model
 * lands on, minus its judgment about who is actually worth the outreach.
 */
export function localBriefing(snapshot: NetworkSnapshot): Briefing {
  const scored: { score: number; action: BriefingAction }[] = []

  for (const { followUp, contact } of snapshot.followUps) {
    const days = daysUntil(followUp.dueDate) ?? 0
    scored.push({
      // Overdue first, then due today — ahead of a meeting later today.
      score: Math.min(days, 0) - 0.5,
      action: {
        kind: 'followup',
        title: followUp.note?.trim() || `Follow up with ${fullName(contact)}`,
        why: days < 0 ? `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}` : `Due ${whenPhrase(days)}`,
        contact,
        followUp,
      },
    })
  }

  for (const { event, attendees } of snapshot.meetings) {
    const days = daysUntil(event.startsAt) ?? 0
    const who = attendees.length ? fullName(attendees[0]) : null
    const unprepared = attendees.length && !attendees.some((c) => c.talkingPoints?.trim())
    const start = new Date(event.startsAt)
    scored.push({
      score: days,
      action: {
        kind: 'prep',
        title: who ? `${event.title} with ${who}` : event.title,
        why: `${event.allDay ? whenPhrase(days) : `${whenPhrase(days)}, ${format(start, 'h:mm a')}`}${unprepared ? ' · no talking points yet' : ''}`,
        event,
        contact: attendees[0],
      },
    })
  }

  let pipeline = 0
  for (const { opp } of snapshot.opportunities) {
    const days = daysUntil(opp.deadline)
    if (days === null || days > 14 || pipeline >= MAX_PIPELINE_ACTIONS) continue
    pipeline++
    scored.push({
      score: days + 0.25,
      action: {
        kind: 'pipeline',
        title: `${opp.company} application`,
        why: `${opp.role} · deadline ${whenPhrase(days)}`,
        opportunity: opp,
      },
    })
  }

  for (const { keyDate, contact } of snapshot.dates) {
    const days = daysUntilKeyDate(keyDate)
    scored.push({
      score: days + 0.5,
      action: {
        kind: 'date',
        title: `${fullName(contact)}’s ${keyDate.label.toLowerCase()}`,
        why: whenPhrase(days).replace(/^./, (c) => c.toUpperCase()),
        contact,
        keyDate,
      },
    })
  }

  // People who've gone quiet have no clock of their own: after anything due
  // in the next couple of days, most overdue first (the snapshot's order).
  snapshot.people.forEach((contact, i) => {
    scored.push({
      score: 2.5 + i * 0.01,
      action: {
        kind: 'reconnect',
        title: `Reach out to ${fullName(contact)}`,
        why: getReconnectStatus(contact).reason,
        contact,
      },
    })
  })

  const actions = scored
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_ACTIONS)
    .map((x) => x.action)
  return { headline: localHeadline(snapshot), actions, fromModel: false }
}

function localHeadline(snapshot: NetworkSnapshot): string {
  if (snapshot.empty) return 'Nothing needs you right now.'
  const bits: string[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (snapshot.followUps.length) bits.push(plural(snapshot.followUps.length, 'follow-up', 'follow-ups'))
  if (snapshot.meetings.length) bits.push(plural(snapshot.meetings.length, 'meeting', 'meetings'))
  if (snapshot.people.length) bits.push(`${snapshot.people.length} to reconnect with`)
  const soon = snapshot.opportunities.filter(({ opp }) => {
    const days = daysUntil(opp.deadline)
    return days !== null && days <= 7
  }).length
  if (soon) bits.push(plural(soon, 'deadline', 'deadlines'))
  if (snapshot.dates.length) bits.push(plural(snapshot.dates.length, 'birthday', 'birthdays'))
  return `${bits.join(', ')}.`.replace(/^./, (c) => c.toUpperCase())
}
