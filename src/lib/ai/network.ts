import { askClaudeJson, truncate, type AiMessage } from './client'
import { getReconnectStatus } from '@/lib/reconnect'
import { CONNECTION_TYPES, MEET_SOURCES } from '@/lib/constants'
import { fullName } from '@/lib/format'
import type { Contact, Tag } from '@/types'

/**
 * "Who do I know in fintech in Boston?" over your own contacts.
 *
 * Fuzzy search finds a string you can already name; this finds people by what
 * you remember about them — and, since the roster carries reconnect state and
 * how you met, answers judgement questions too ("who should I ask for a
 * referral?", "how many people do I know at Fidelity?").
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

const SYSTEM = `You help someone search and reason about their own personal \
CRM — the people they have met and written down. You are given a numbered \
roster of those people, then questions about it, one at a time.

Reply to every question with a single JSON object and nothing else:
{"answer": "one to three sentences", "matches": [{"n": 3, "why": "one short line"}], "followUps": ["…"]}

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
any named company or person.`

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
        content: `Roster (${built.included.length} people):\n${built.text}\n\nQuestion: ${asked}`,
      },
    ]
  } else {
    turns = [...turns, { role: 'user', content: `Question: ${asked}` }]
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
  })
}

/** Keep the roster message and the tail of the thread; drop the middle. */
function trimHistory(turns: AiMessage[]): AiMessage[] {
  if (turns.length <= MAX_HISTORY_TURNS + 1) return turns
  return [turns[0], ...turns.slice(-MAX_HISTORY_TURNS)]
}
