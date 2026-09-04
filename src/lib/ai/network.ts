import { askClaudeJson, truncate } from './client'
import { getReconnectStatus } from '@/lib/reconnect'
import { CONNECTION_TYPES, MEET_SOURCES } from '@/lib/constants'
import { fullName } from '@/lib/format'
import type { Contact, Tag } from '@/types'

/**
 * "Who do I know in fintech in Boston?" over your own contacts.
 *
 * Fuzzy search finds a string you can already name; this finds people by what
 * you remember about them. It's one request per question — a compact roster
 * goes up, a shortlist of ids with reasons comes back — and it falls back to
 * the Fuse index if anything goes wrong, so the search box never breaks.
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
  matches: NetworkMatch[]
  /** A sentence of framing, when the model offers one. */
  summary?: string
}

/** Roster caps — a payload this size costs cents, not dollars. */
const MAX_CONTACTS = 400
const MAX_NOTE_CHARS = 160
const MAX_ROSTER_CHARS = 40_000
const MAX_MATCHES = 12

const SYSTEM = `You help someone search their own personal CRM by meaning \
rather than by keyword. You are given a numbered roster of the people they \
know and one question about it.

Reply with a single JSON object and nothing else:
{"summary": "one short sentence", "matches": [{"n": 3, "why": "one short line"}]}

Rules:
- "n" must be a number from the roster. Never invent a person.
- Order matches best-first and return at most ${MAX_MATCHES}.
- "why" is one specific line grounded in that person's roster entry — the \
company, school, tag, or note that makes them the right person to ask. Never \
restate the question.
- If nobody genuinely fits, return an empty matches array and say so in \
"summary". A weak honest answer beats a confident wrong one.
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

interface RawAnswer {
  summary?: unknown
  matches?: unknown
}

export async function askNetwork(
  question: string,
  contacts: Contact[],
  tagMap: Map<string, Tag>,
  signal?: AbortSignal,
): Promise<NetworkAnswer> {
  const { text, included } = buildRoster(contacts, tagMap)

  const raw = await askClaudeJson<RawAnswer>({
    system: SYSTEM,
    maxTokens: 900,
    signal,
    messages: [
      {
        role: 'user',
        content: `Roster (${included.length} people):\n${text}\n\nQuestion: ${truncate(question, 400)}`,
      },
    ],
  })

  const matches: NetworkMatch[] = []
  const seen = new Set<string>()
  for (const entry of Array.isArray(raw.matches) ? raw.matches : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const { n, why } = entry as { n?: unknown; why?: unknown }
    const index = typeof n === 'number' ? Math.floor(n) : Number.NaN
    const contact = included[index - 1]
    // Guards against a hallucinated index or the same person listed twice.
    if (!contact || seen.has(contact.id)) continue
    seen.add(contact.id)
    matches.push({
      contact,
      reason: typeof why === 'string' ? truncate(why, 180) : '',
    })
    if (matches.length >= MAX_MATCHES) break
  }

  return {
    matches,
    summary: typeof raw.summary === 'string' ? truncate(raw.summary, 240) : undefined,
  }
}
