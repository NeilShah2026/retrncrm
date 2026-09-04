import { askClaudeJson, truncate } from './client'
import { getReconnectStatus } from '@/lib/reconnect'
import { CONNECTION_TYPES, OPPORTUNITY_STAGES } from '@/lib/constants'
import { fullName, daysSince } from '@/lib/format'
import type { CalendarEvent, Contact, Opportunity, Tag } from '@/types'

/**
 * "What should I actually do today?"
 *
 * The dashboard already shows counts — overdue people, meetings, deadlines.
 * Counts are not a decision. This takes the same three lists, hands the model
 * a compact snapshot of them, and gets back a handful of specific, ordered
 * actions with the reason each one made the cut.
 *
 * Two rules hold it to the same bargain as the rest of the AI here: every
 * action must point at a real record (the model answers with a reference into
 * the snapshot, never a name it typed), and if the model is unreachable
 * `localBriefing` produces the same shape from plain rules — so the section
 * is useful with AI switched off, just less pointed.
 */

export type BriefingKind = 'prep' | 'reconnect' | 'draft' | 'pipeline'

export interface BriefingAction {
  kind: BriefingKind
  /** Imperative, one line: the thing to do. */
  title: string
  /** Why it made the list, grounded in the user's own records. */
  why: string
  contact?: Contact
  opportunity?: Opportunity
  event?: CalendarEvent
}

export interface Briefing {
  headline: string
  actions: BriefingAction[]
  /** False when the local rules wrote it because the model was unavailable. */
  fromModel: boolean
}

/** The three lists worth acting on, already trimmed to what fits a prompt. */
export interface NetworkSnapshot {
  people: Contact[]
  meetings: { event: CalendarEvent; attendees: Contact[] }[]
  opportunities: { opp: Opportunity; helpers: Contact[] }[]
  /** Nothing to brief on at all — the caller shows an empty state instead. */
  empty: boolean
}

const MAX_PEOPLE = 18
const MAX_MEETINGS = 8
const MAX_OPPS = 8
const MAX_ACTIONS = 5
/** Meetings this far out are "coming up"; past that they aren't today's problem. */
const MEETING_HORIZON_DAYS = 14
const DEADLINE_HORIZON_DAYS = 30

/** Days from now until an ISO date (negative = already past). */
export function daysUntil(iso?: string | null): number | null {
  const past = daysSince(iso)
  return past === null ? null : -past
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
): NetworkSnapshot {
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const meetings = events
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

  // Someone you're about to sit down with doesn't also belong on the
  // "you've gone quiet on them" list — the meeting is the action.
  const scheduled = new Set(meetings.flatMap((m) => m.event.contactIds))

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
    empty: people.length === 0 && meetings.length === 0 && opps.length === 0,
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
  parts.push(whenPhrase(daysUntil(event.startsAt) ?? 0))
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

const SYSTEM = `You are the morning briefing for someone's personal CRM. They \
are a student or early-career professional keeping track of people they've met.

You are given three lists from their own records: meetings coming up (M), \
people they have gone quiet on (P), and job applications in flight (O).

Reply with a single JSON object and nothing else:
{"headline": "one short sentence", "actions": [{"ref": "P3", "kind": "reconnect", "do": "…", "why": "…"}]}

Rules:
- "ref" must be an id that appears in the lists above. Never invent a person, \
a meeting, or a company, and never reference the same one twice.
- "kind" is one of: "prep" (get ready for a meeting), "reconnect" (reach out \
to someone who has gone quiet), "draft" (write a specific message), \
"pipeline" (act on an application).
- At most ${MAX_ACTIONS} actions, most urgent first. Fewer is better than \
padding — only include something genuinely worth doing this week.
- "do" is an imperative under 10 words: "Prep for coffee with Dana Cruz".
- "why" is one line under 20 words citing the specific fact that made it \
urgent — the date, the deadline, how long it has been. Never restate "do".
- A meeting in the next two days outranks anything else.
- "headline" states the shape of the day in one sentence. No greeting, no \
pep talk, no exclamation marks.
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

const KINDS: BriefingKind[] = ['prep', 'reconnect', 'draft', 'pipeline']

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
  ]
  const joined = parts.join('|')
  let hash = 0
  for (let i = 0; i < joined.length; i++) {
    hash = (hash * 31 + joined.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
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

  for (const entry of Array.isArray(raw.actions) ? raw.actions : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const { ref, kind, do: title, why } = entry as RawAction
    if (typeof ref !== 'string' || typeof title !== 'string' || !title.trim()) continue

    const match = /^([PMO])(\d+)$/i.exec(ref.trim())
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
    } else {
      const entry = snapshot.opportunities[index]
      if (!entry) continue
      action.opportunity = entry.opp
      action.kind = 'pipeline'
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

  const raw = await askClaudeJson<RawBriefing>({
    system: SYSTEM,
    maxTokens: 800,
    signal: options.signal,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
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

  const actions = briefing.actions.flatMap((action): BriefingAction[] => {
    if (action.event) {
      const event = meetings.get(action.event.id)
      if (!event) return []
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
 * The same briefing, written by rules. Meetings first (they have a clock),
 * then imminent deadlines, then the people who have waited longest — which is
 * roughly the order the model lands on anyway, minus the judgment about who is
 * actually worth the outreach.
 */
export function localBriefing(snapshot: NetworkSnapshot): Briefing {
  const actions: BriefingAction[] = []

  for (const { event, attendees } of snapshot.meetings) {
    if (actions.length >= MAX_ACTIONS) break
    const days = daysUntil(event.startsAt) ?? 0
    if (days > 3) break
    const who = attendees.length ? fullName(attendees[0]) : null
    const unprepared = attendees.length && !attendees.some((c) => c.talkingPoints?.trim())
    actions.push({
      kind: 'prep',
      title: who ? `Prep for ${event.title} with ${who}` : `Prep for ${event.title}`,
      why: `${whenPhrase(days)}${unprepared ? ' · no talking points saved yet' : ''}`,
      event,
      contact: attendees[0],
    })
  }

  for (const { opp } of snapshot.opportunities) {
    if (actions.length >= MAX_ACTIONS) break
    const days = daysUntil(opp.deadline)
    if (days === null || days > 7) continue
    actions.push({
      kind: 'pipeline',
      title: `Finish the ${opp.company} application`,
      why: `${opp.role} · deadline ${whenPhrase(days)}`,
      opportunity: opp,
    })
  }

  for (const contact of snapshot.people) {
    if (actions.length >= MAX_ACTIONS) break
    actions.push({
      kind: 'reconnect',
      title: `Reach out to ${fullName(contact)}`,
      why: getReconnectStatus(contact).reason,
      contact,
    })
  }

  return { headline: localHeadline(snapshot), actions, fromModel: false }
}

function localHeadline(snapshot: NetworkSnapshot): string {
  if (snapshot.empty) return 'Nothing needs you right now.'
  const bits: string[] = []
  if (snapshot.meetings.length) {
    bits.push(
      `${snapshot.meetings.length} meeting${snapshot.meetings.length === 1 ? '' : 's'} coming up`,
    )
  }
  if (snapshot.people.length) {
    bits.push(`${snapshot.people.length} to reconnect with`)
  }
  const soon = snapshot.opportunities.filter(({ opp }) => {
    const days = daysUntil(opp.deadline)
    return days !== null && days <= 7
  }).length
  if (soon) bits.push(`${soon} deadline${soon === 1 ? '' : 's'} inside a week`)
  return `${bits.join(', ')}.`.replace(/^./, (c) => c.toUpperCase())
}
