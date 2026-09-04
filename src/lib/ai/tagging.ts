import { askClaudeJson, truncate } from './client'
import { CONNECTION_TYPES, MEET_SOURCES } from '@/lib/constants'
import { fullName } from '@/lib/format'
import {
  MAX_TAGS_PER_CONTACT,
  toSuggestions,
  type TagSubject,
  type TagSuggestion,
} from '@/lib/tagging'
import type { ConnectionType, Contact, MeetSource, Tag } from '@/types'

/**
 * Tags, read off the record instead of typed.
 *
 * Tagging is the chore of a personal CRM: the value shows up months later
 * ("who do I know in fintech?") and the cost lands the moment you meet
 * someone, so it doesn't get done. The model is good at exactly the judgement
 * that makes it a chore — that an "Associate, Growth Equity" and a "VC summer
 * analyst" belong under the same label you already use.
 *
 * Two entry points, one set of rules: one person (the form's Suggest button)
 * and a roomful (the Auto-tag pass over the whole network). Both come back as
 * suggestions — a name, plus the existing tag it resolved to — and neither
 * writes anything. The caller applies what the user keeps.
 *
 * Two rules matter more than the rest of the prompt:
 * - The user's existing tags are the vocabulary. A new tag is a last resort,
 *   because a network sliced forty ways is a network with no tags at all.
 * - Tags come off the record. The model is told, twice, not to reach for what
 *   it happens to know about a company.
 */

/**
 * Contacts per request in the bulk pass — big enough to be cheap, small
 * enough that one bad response doesn't cost the whole run.
 */
const BATCH_SIZE = 20

/** Roughly this many output tokens per person, plus JSON scaffolding. */
const TOKENS_PER_CONTACT = 45

const MAX_NOTE_CHARS = 200

/** The shared instructions. `vocabulary` is the user's existing tag names. */
function rules(vocabulary: string[]): string {
  const vocabularyBlock = vocabulary.length
    ? `The tags this person already uses — strongly prefer these, copied exactly:\n${vocabulary
        .map((t) => `- ${t}`)
        .join('\n')}`
    : 'This user has no tags yet, so anything you propose will be a new tag. Keep them broad enough that the next person they meet can share one.'

  return `You label people in someone's personal CRM with short, reusable tags.

Tags are for finding people again later: "who do I know in fintech?", "who \
were the recruiters at the fall career fair?". A good tag groups this person \
with others; a tag that could only ever apply to one person is noise.

${vocabularyBlock}

Rules:
- Reuse an existing tag whenever it fits, spelled exactly as listed above. \
Propose a new one only when nothing listed covers something clearly true of \
this person and likely to be true of others they meet.
- At most ${MAX_TAGS_PER_CONTACT} tags per person. Fewer is better, and an \
empty list is the right answer for a thin record.
- 1-3 words, Title Case ("Fintech", "Product Management", "Babson Alumni").
- Tag industry, function, company type, school, club, community, or why this \
person matters to the user. Never their name, never a date.
- Use only the facts you are given. Do not use outside knowledge about a \
company, school, or job title beyond what its words plainly mean. If a record \
is only a name, return nothing for it.`
}

/** One person, described for tagging — the tagging-relevant fields only. */
function subjectLines(subject: TagSubject): string[] {
  const lines: string[] = []

  const role = [subject.jobTitle, subject.company].filter(Boolean).join(' at ')
  if (role) lines.push(role)
  if (subject.industry) lines.push(`industry: ${subject.industry}`)

  const school = [
    subject.school,
    subject.major,
    subject.gradYear && `class of ${subject.gradYear}`,
  ]
    .filter(Boolean)
    .join(', ')
  if (school) lines.push(`school: ${school}`)

  if (subject.connectionType) {
    lines.push(
      `relationship: ${CONNECTION_TYPES[subject.connectionType as ConnectionType].label}`,
    )
  }

  const where =
    subject.whereWeMet ||
    (subject.source ? MEET_SOURCES[subject.source as MeetSource].label : undefined)
  if (where) lines.push(`met at ${where}`)
  if (subject.howWeMet) lines.push(`how they met: ${truncate(subject.howWeMet, 120)}`)
  if (subject.notes) lines.push(`notes: ${truncate(subject.notes, MAX_NOTE_CHARS)}`)

  return lines
}

/** True when there's anything to go on besides a name. */
export function hasTaggableDetail(subject: TagSubject): boolean {
  return subjectLines(subject).length > 0
}

interface RawTags {
  tags?: unknown
}

/**
 * Tags for one person. Throws on any transport or parse failure — callers
 * fall back to `suggestTagsLocally`.
 */
export async function suggestTagsForSubject(
  subject: TagSubject,
  tags: Tag[],
  exclude: string[] = [],
  signal?: AbortSignal,
): Promise<TagSuggestion[]> {
  const name =
    [subject.firstName, subject.lastName].filter(Boolean).join(' ').trim() ||
    'Unnamed contact'

  const raw = await askClaudeJson<RawTags>({
    system: `${rules(tags.map((t) => t.name))}

Reply with a single JSON object and nothing else: {"tags": ["…"]}`,
    maxTokens: 200,
    signal,
    messages: [
      { role: 'user', content: [name, ...subjectLines(subject)].join('\n') },
    ],
  })

  const names = Array.isArray(raw.tags) ? (raw.tags as string[]) : []
  return toSuggestions(names, tags, exclude)
}

/** What the bulk pass produces: contactId → the tags proposed for them. */
export type BulkTagResult = Map<string, TagSuggestion[]>

interface RawBulk {
  people?: unknown
}

interface RawBulkEntry {
  n?: unknown
  tags?: unknown
}

/**
 * Tags for a whole roster, in batches.
 *
 * Contacts are referred to by their position in the batch, never by id, so a
 * model that invents a number loses that entry rather than tagging the wrong
 * person. A failed batch is reported through `onError` and the run carries on:
 * a partial answer over two hundred people is worth far more than nothing, and
 * the user reviews all of it before a single tag is written.
 */
export async function suggestTagsForContacts(
  contacts: Contact[],
  tags: Tag[],
  options: {
    signal?: AbortSignal
    /** Called after each batch with how many contacts have been read so far. */
    onProgress?: (done: number, total: number) => void
    onError?: (error: unknown) => void
  } = {},
): Promise<BulkTagResult> {
  const { signal, onProgress, onError } = options
  const results: BulkTagResult = new Map()

  const system = `${rules(tags.map((t) => t.name))}

You are given a numbered list of people. Reply with a single JSON object and \
nothing else:
{"people": [{"n": 1, "tags": ["…"]}]}

- "n" is the number from the list. Include someone only when you have a tag \
for them; omit anyone whose record is too thin.
- Never use a number that isn't in the list.`

  let done = 0
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    if (signal?.aborted) break
    const batch = contacts.slice(i, i + BATCH_SIZE)
    const roster = batch
      .map((c, n) => {
        const detail = subjectLines(c).join(' | ')
        return `${n + 1}. ${fullName(c)}${detail ? ` — ${detail}` : ''}`
      })
      .join('\n')

    try {
      const raw = await askClaudeJson<RawBulk>({
        system,
        maxTokens: batch.length * TOKENS_PER_CONTACT + 100,
        signal,
        messages: [{ role: 'user', content: roster }],
      })
      const people = Array.isArray(raw.people) ? (raw.people as RawBulkEntry[]) : []
      for (const entry of people) {
        const n = typeof entry?.n === 'number' ? entry.n : Number(entry?.n)
        const contact = Number.isInteger(n) ? batch[n - 1] : undefined
        if (!contact) continue
        const names = Array.isArray(entry.tags) ? (entry.tags as string[]) : []
        const suggestions = toSuggestions(names, tags, contact.tagIds)
        if (suggestions.length) results.set(contact.id, suggestions)
      }
    } catch (err) {
      // One bad batch shouldn't cost the other nineteen in twenty.
      onError?.(err)
    }

    done += batch.length
    onProgress?.(done, contacts.length)
  }

  return results
}
