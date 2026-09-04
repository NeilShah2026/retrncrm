import { format } from 'date-fns'
import { askClaudeJson, truncate, type AiMessage } from './client'
import { parseActions, type AssistantAction } from './actions'
import { getReconnectStatus } from '@/lib/reconnect'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_KEYS,
  FREQUENCY_KEYS,
  MEET_SOURCES,
  MEET_SOURCE_KEYS,
  OPPORTUNITY_STAGE_KEYS,
  OPPORTUNITY_TYPE_KEYS,
} from '@/lib/constants'
import { fullName } from '@/lib/format'
import type { Contact, Tag } from '@/types'

/**
 * The assistant: one box that both answers questions about your network and
 * records what you tell it.
 *
 * Asking — "who do I know in fintech in Boston?" — is what this started as.
 * Fuzzy search finds a string you can already name; this finds people by what
 * you remember about them, and since the roster carries reconnect state and
 * how you met, it answers judgement questions too ("who should I ask for a
 * referral?", "how many people do I know at Fidelity?").
 *
 * Telling — "met Priya at the AI meetup, she's a PM at Klaviyo, coffee next
 * Tuesday at 3" — comes back as a *plan* in `actions`: typed, validated,
 * previewable, and not yet saved. The same thread does both because the same
 * sentence often is both, and because a person shouldn't have to know which
 * box they're in. `lib/ai/actions.ts` owns everything about what an action is
 * and how it runs; this file only asks for them and hands them back parsed.
 *
 * It's a conversation, not a single shot: the roster goes up once, in the
 * first message, and follow-ups ride on the same thread, so "what about the
 * ones in Boston?" costs a sentence rather than another roster. Everything
 * falls back to the Fuse index if anything goes wrong, so the search box
 * never breaks.
 *
 * The roster is deliberately lossy: contacts are referred to by position, not
 * id, and notes are clipped, which keeps a few hundred people inside a couple
 * of thousand tokens.
 */

export interface NetworkMatch {
  contact: Contact
  /** One line on why this person answers the question. */
  reason: string
}

export interface NetworkAnswer {
  /** The answer in prose — the part that isn't a list of people. */
  answer: string
  matches: NetworkMatch[]
  /** Questions worth asking next, offered as chips. */
  followUps: string[]
  /**
   * What the message asked to be recorded, validated and ready to preview.
   * Nothing here has happened yet — the user approves the list first (see
   * `lib/ai/actions.ts`).
   */
  actions: AssistantAction[]
}

/**
 * One thread of questions against one roster. Immutable: `askNetwork` returns
 * the next session rather than mutating this one, so React state stays honest.
 */
export interface NetworkSession {
  /** Index-aligned with the numbering the model was given. */
  roster: Contact[]
  turns: AiMessage[]
}

/** Roster caps — a payload this size costs cents, not dollars. */
const MAX_CONTACTS = 400
const MAX_NOTE_CHARS = 160
const MAX_ROSTER_CHARS = 40_000
const MAX_MATCHES = 12
const MAX_FOLLOW_UPS = 3
/** Turns kept after the roster message, so a long thread stays affordable. */
const MAX_HISTORY_TURNS = 8
/** Told to the model; `parseActions` enforces the real cap. */
const MAX_ACTIONS_HINT = 8

const SYSTEM = `You are the assistant inside someone's personal CRM — the \
people they have met and written down. You are given a numbered roster of \
those people, then messages about it, one at a time. A message is either a \
question about the roster, or an instruction to record something.

Reply to every message with a single JSON object and nothing else:
{"answer": "one to three sentences", "matches": [{"n": 3, "why": "one short line"}], "followUps": ["…"], "actions": []}

Rules:
- "n" must be a number from the roster. Never invent a person.
- Order matches best-first and return at most ${MAX_MATCHES}.
- "why" is one specific line grounded in that person's roster entry — the \
company, school, tag, note, or how long it has been since they spoke. Never \
restate the question.
- "answer" answers the question directly. If it is a counting or comparing \
question, give the number or the comparison. If it is a "who should I…" \
question, say who and why in one line. Do not just list names that are \
already in "matches".
- If nobody genuinely fits, return an empty matches array and say so plainly. \
A weak honest answer beats a confident wrong one.
- "followUps" is up to ${MAX_FOLLOW_UPS} short questions this person could \
usefully ask next about this same roster, phrased in their voice. Omit it \
when nothing obvious follows.
- Later questions refer to the same roster and may build on your previous \
answers ("what about the ones in Boston?").
- The roster is the only thing you know. Do not use outside knowledge about \
any named company or person.

ACTIONS

When the message asks you to *record* something — "met Priya at the AI meetup, \
she's a PM at Klaviyo", "coffee with Sarah next Tuesday at 3", "I spoke to \
Marcus today", "tag Dan as fintech", "add the Fidelity internship, due Nov 1" \
— put it in "actions" and say what you are about to do in "answer". The user \
approves the list before any of it is saved, so propose the whole request; \
never ask for confirmation in "answer" and never claim something is already \
done.

Every action is one of these objects. Omit any optional field the message \
doesn't give you — never invent a company, title, email, or time:
{"type":"add_contact","firstName":"…","lastName":"…","company":"…","jobTitle":"…","school":"…","connectionType":"…","source":"…","whereWeMet":"…","howWeMet":"…","email":"…","phone":"…","notes":"…","tagNames":["…"]}
{"type":"schedule_meeting","title":"…","startsAtLocal":"YYYY-MM-DDTHH:mm","durationMinutes":30,"allDay":false,"location":"…","people":["Full Name"]}
{"type":"log_caught_up","person":"Full Name","date":"YYYY-MM-DD"}
{"type":"add_note","person":"Full Name","text":"…"}
{"type":"add_tags","person":"Full Name","tagNames":["…"]}
{"type":"set_followup","person":"Full Name","frequency":"${FREQUENCY_KEYS.join('|')}"}
{"type":"add_opportunity","company":"…","role":"…","opportunityType":"${OPPORTUNITY_TYPE_KEYS.join('|')}","stage":"${OPPORTUNITY_STAGE_KEYS.join('|')}","deadline":"YYYY-MM-DD","people":["Full Name"]}

connectionType is one of ${CONNECTION_TYPE_KEYS.join(', ')}. \
source is one of ${MEET_SOURCE_KEYS.join(', ')}.

Action rules:
- "person" and "people" are names. Use a roster name exactly as it is spelled \
there when you mean someone already in it. If the message introduces someone \
new *and* schedules with them, emit add_contact first and use that same name \
in the later action.
- Dates and times are absolute local wall-clock, resolved from today's date, \
which is given with the roster. "next Tuesday at 3" becomes a real \
YYYY-MM-DDTHH:mm. Never return a relative phrase. Assume a sensible hour when \
one isn't given (coffee 9am, lunch 12pm, a call 10am) and say which you \
assumed in "answer".
- Propose at most ${MAX_ACTIONS_HINT} actions, and only what was actually \
asked for. Recording a person you were only asked about is wrong.
- A question is not an instruction. "who should I follow up with?" is answered \
with matches and no actions.
- There is no action for deleting or editing anything. If the message asks for \
one, say so plainly in "answer" and return no actions.`

/** Today, as the model is asked to write dates. */
function todayStamp(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** One roster line: everything worth matching on, nothing worth paying for. */
function rosterLine(contact: Contact, index: number, tagMap: Map<string, Tag>): string {
  const parts: string[] = [`${index}. ${fullName(contact)}`]

  const role = [contact.jobTitle, contact.company].filter(Boolean).join(' at ')
  if (role) parts.push(role)
  if (contact.industry) parts.push(contact.industry)

  const school = [contact.school, contact.gradYear && `'${contact.gradYear.slice(-2)}`]
    .filter(Boolean)
    .join(' ')
  if (school) parts.push(school)
  if (contact.major) parts.push(contact.major)

  if (contact.connectionType) parts.push(CONNECTION_TYPES[contact.connectionType].label)

  const where =
    contact.whereWeMet ??
    (contact.source ? MEET_SOURCES[contact.source].label : undefined)
  if (where) parts.push(`met at ${where}`)

  const tags = contact.tagIds
    .map((id) => tagMap.get(id)?.name)
    .filter(Boolean)
    .join(', ')
  if (tags) parts.push(`tags: ${tags}`)

  // Reconnect state, so "who should I catch up with?" is answerable here too.
  const status = getReconnectStatus(contact)
  if (contact.lastContactDate) {
    parts.push(
      `last contact ${contact.lastContactDate}${status.overdue ? ' (overdue)' : ''}`,
    )
  } else if (status.overdue) {
    parts.push('never followed up')
  }

  const notes = truncate(
    [contact.howWeMet, contact.talkingPoints, contact.notes].filter(Boolean).join('. '),
    MAX_NOTE_CHARS,
  )
  if (notes) parts.push(`notes: ${notes}`)

  return parts.join(' | ')
}

/** The roster, capped both by count and by total size. */
export function buildRoster(
  contacts: Contact[],
  tagMap: Map<string, Tag>,
): { text: string; included: Contact[] } {
  // Richest records first, so a cap trims the people we know least about.
  const ordered = [...contacts]
    .sort((a, b) => detail(b) - detail(a))
    .slice(0, MAX_CONTACTS)

  const lines: string[] = []
  const included: Contact[] = []
  let size = 0
  for (const contact of ordered) {
    const line = rosterLine(contact, included.length + 1, tagMap)
    if (size + line.length > MAX_ROSTER_CHARS) break
    lines.push(line)
    included.push(contact)
    size += line.length + 1
  }
  return { text: lines.join('\n'), included }
}

/** A rough "how much do we know about this person" score, for the size cap. */
function detail(c: Contact): number {
  return (
    (c.company ? 2 : 0) +
    (c.jobTitle ? 2 : 0) +
    (c.school ? 1 : 0) +
    (c.notes ? 2 : 0) +
    (c.howWeMet ? 1 : 0) +
    c.tagIds.length +
    c.interactions.length
  )
}

/**
 * A fresh thread. Free: the roster is built by the first question, against the
 * contacts as they are then rather than as they were when the dialog opened.
 */
export function startSession(): NetworkSession {
  return { roster: [], turns: [] }
}

interface RawAnswer {
  answer?: unknown
  summary?: unknown
  matches?: unknown
  followUps?: unknown
  actions?: unknown
}

/**
 * Ask one question on a thread. Returns the answer plus the session to pass
 * back for the follow-up — the roster is only ever sent in the first turn.
 */
export async function askNetwork(
  session: NetworkSession,
  question: string,
  contacts: Contact[],
  tagMap: Map<string, Tag>,
  signal?: AbortSignal,
): Promise<{ answer: NetworkAnswer; session: NetworkSession }> {
  const asked = truncate(question, 400)

  let roster = session.roster
  let turns = session.turns
  if (turns.length === 0) {
    // Build the roster now so it reflects the contacts as they are today,
    // not as they were when the dialog opened.
    const built = buildRoster(contacts, tagMap)
    roster = built.included
    turns = [
      {
        role: 'user',
        content: [
          `Today is ${format(new Date(), 'EEEE, d MMMM yyyy')} (${todayStamp()}), local time.`,
          '',
          `Roster (${built.included.length} people):`,
          built.text,
          '',
          `Message: ${asked}`,
        ].join('\n'),
      },
    ]
  } else {
    // Today's date is repeated on every turn: a thread opened yesterday can
    // still be told to schedule something "tomorrow".
    turns = [
      ...turns,
      { role: 'user', content: `Today is ${todayStamp()}.\nMessage: ${asked}` },
    ]
  }

  const raw = await askClaudeJson<RawAnswer>({
    system: SYSTEM,
    maxTokens: 1000,
    signal,
    messages: trimHistory(turns),
  })

  const matches: NetworkMatch[] = []
  const seen = new Set<string>()
  for (const entry of Array.isArray(raw.matches) ? raw.matches : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const { n, why } = entry as { n?: unknown; why?: unknown }
    const index = typeof n === 'number' ? Math.floor(n) : Number.NaN
    const contact = roster[index - 1]
    // Guards against a hallucinated index or the same person listed twice.
    if (!contact || seen.has(contact.id)) continue
    seen.add(contact.id)
    matches.push({
      contact,
      reason: typeof why === 'string' ? truncate(why, 180) : '',
    })
    if (matches.length >= MAX_MATCHES) break
  }

  // "summary" is what earlier versions of this prompt asked for; accept it so
  // a model that reaches for the old key still says something.
  const prose = [raw.answer, raw.summary].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )

  const followUps = (Array.isArray(raw.followUps) ? raw.followUps : [])
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .slice(0, MAX_FOLLOW_UPS)
    .map((f) => truncate(f, 90))

  const answer: NetworkAnswer = {
    answer: prose ? truncate(prose, 400) : '',
    matches,
    followUps,
    actions: parseActions(raw.actions),
  }

  return {
    answer,
    // Record a compact, valid version of what came back rather than the raw
    // reply: it keeps the thread small and can't feed malformed JSON back in.
    session: {
      roster,
      turns: [...turns, { role: 'assistant', content: replay(answer, roster) }],
    },
  }
}

/** The assistant turn as the model would have written it, minus the noise. */
function replay(answer: NetworkAnswer, roster: Contact[]): string {
  return JSON.stringify({
    answer: answer.answer,
    matches: answer.matches.map((m) => ({
      n: roster.indexOf(m.contact) + 1,
      why: m.reason,
    })),
    // Kept so a follow-up ("make it 4pm instead") knows what was already
    // proposed — and doesn't propose it a second time.
    actions: answer.actions,
  })
}

/** Keep the roster message and the tail of the thread; drop the middle. */
function trimHistory(turns: AiMessage[]): AiMessage[] {
  if (turns.length <= MAX_HISTORY_TURNS + 1) return turns
  return [turns[0], ...turns.slice(-MAX_HISTORY_TURNS)]
}
