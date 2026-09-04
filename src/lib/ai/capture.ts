import { askClaudeJson, truncate } from './client'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_KEYS,
  FREQUENCY_KEYS,
  FREQUENCY_OPTIONS,
  MEET_SOURCES,
  MEET_SOURCE_KEYS,
} from '@/lib/constants'
import { MAX_TAGS_PER_CONTACT } from '@/lib/tagging'
import type { ParsedCapture } from '@/lib/voiceParse'
import type { ConnectionType, ContactFrequency, MeetSource } from '@/types'

/**
 * A second read of the capture sentence.
 *
 * The regex parser in `lib/voiceParse.ts` stays the instant, free, offline
 * default — it runs on every keystroke and is what you see while you talk.
 * This runs once, on demand, and only to fix what a regex can't: a name it
 * mistook for a company, an unpunctuated run-on, a title phrased sideways.
 * Its output is merged into the same review chips and every change is shown,
 * because the user confirms the contact, not the model.
 */

/** A field the second read filled in or disagreed with. */
export interface CaptureChange {
  key: keyof ParsedCapture
  label: string
  /** Humanized previous value, absent when the field was empty. */
  from?: string
  /** Humanized new value. */
  to: string
}

export interface CaptureRefinement {
  parsed: ParsedCapture
  changes: CaptureChange[]
}

/** Fields the model is allowed to touch, and what to call them in the diff. */
const FIELD_LABELS: Partial<Record<keyof ParsedCapture, string>> = {
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  jobTitle: 'Title',
  school: 'School',
  gradYear: 'Class of',
  major: 'Major',
  connectionType: 'Relationship',
  source: 'Met at',
  whereWeMet: 'Where',
  howWeMet: 'How you met',
  email: 'Email',
  phone: 'Phone',
  linkedinUrl: 'LinkedIn',
  contactFrequencyGoal: 'Follow up',
  tagNames: 'Tags',
  notes: 'Note',
}

/**
 * Fields whose previous value isn't worth showing struck through — the raw
 * transcript is already on screen in the textarea directly above.
 */
const DIFF_HIDES_PREVIOUS = new Set<keyof ParsedCapture>(['notes'])

const TEXT_KEYS = [
  'firstName',
  'lastName',
  'company',
  'jobTitle',
  'school',
  'gradYear',
  'major',
  'whereWeMet',
  'howWeMet',
  'email',
  'phone',
  'linkedinUrl',
] as const

const SYSTEM = `You extract one contact record from a sentence someone dictated \
right after meeting a person. You are correcting a regex parser that has \
already had a go, so be conservative: only contradict it when the sentence \
clearly supports you.

Reply with a single JSON object and nothing else. Every key is optional — omit \
anything the sentence does not actually say. Never invent a company, school, \
title, or contact detail that isn't there.

Keys:
  firstName, lastName, company, jobTitle, school, major (plain strings)
  gradYear (4-digit year as a string)
  whereWeMet (the named place or event), howWeMet (a short phrase)
  email, phone, linkedinUrl
  connectionType: one of ${CONNECTION_TYPE_KEYS.join(', ')}
  source: one of ${MEET_SOURCE_KEYS.join(', ')}
  contactFrequencyGoal: one of ${FREQUENCY_KEYS.join(', ')}
  tagNames: tags for this person (see the tag rule below)
  notes: the sentence rewritten as a clean note about this person

Rules:
- The speaker is the user; the person described is the contact. "I" is never the contact.
- Expand spoken shorthand in titles ("PM" -> "Product Manager").
- Fix dictation artifacts in names and companies, but keep real spellings.
- A school is only a school if the sentence says so; a workplace is the company.
- Use contactFrequencyGoal only for an explicit cadence ("follow up in a month").
- Tags: always include a tag the speaker asked for out loud. Beyond those, \
add a tag from the user's existing tag list (given below the sentence) when \
the sentence plainly puts this person in it, and at most one new tag of your \
own when nothing existing covers something clearly true of them. Four tags \
maximum, 1-3 words each, Title Case, reusing an existing tag's exact \
spelling. Never a tag that could only ever apply to this one person.
- "notes" keeps every concrete detail from the sentence — including anything that didn't fit a field above — but drops dictation filler ("um", "like"), repeated words, and the self-referential opener ("met a guy named…"). Write it about them, punctuated, in at most two sentences. Add nothing that wasn't said. Omit the key entirely if the sentence is only the fields and has nothing left worth remembering.`

interface RawCapture {
  firstName?: unknown
  lastName?: unknown
  company?: unknown
  jobTitle?: unknown
  school?: unknown
  gradYear?: unknown
  major?: unknown
  whereWeMet?: unknown
  howWeMet?: unknown
  email?: unknown
  phone?: unknown
  linkedinUrl?: unknown
  connectionType?: unknown
  source?: unknown
  contactFrequencyGoal?: unknown
  tagNames?: unknown
  notes?: unknown
}

function cleanText(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined
  const s = value.replace(/\s+/g, ' ').trim()
  if (!s || s.length > max) return undefined
  // Models occasionally echo a placeholder rather than omitting the key.
  if (/^(null|none|n\/a|unknown|undefined)$/i.test(s)) return undefined
  return s
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim().toLowerCase() as T
  return allowed.includes(v) ? v : undefined
}

/** How a value reads in the "AI changed" list. */
function humanize(key: keyof ParsedCapture, value: unknown): string {
  if (key === 'connectionType') {
    return CONNECTION_TYPES[value as ConnectionType]?.label ?? String(value)
  }
  if (key === 'source') return MEET_SOURCES[value as MeetSource]?.label ?? String(value)
  if (key === 'contactFrequencyGoal') {
    return FREQUENCY_OPTIONS[value as ContactFrequency]?.short ?? String(value)
  }
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/**
 * Ask the model to re-read `transcript` and merge its answer into `local`.
 * Throws on any transport or parse failure — callers keep the local parse.
 */
export async function refineCapture(
  transcript: string,
  local: ParsedCapture,
  /**
   * The user's existing tag names. Given to the model so a captured person
   * joins the tags already in use instead of starting a parallel vocabulary —
   * the tags it picks land in the same reviewed change list as everything else.
   */
  tagVocabulary: string[] = [],
): Promise<CaptureRefinement> {
  const raw = await askClaudeJson<RawCapture>({
    system: SYSTEM,
    maxTokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          `Sentence: "${truncate(transcript, 1200)}"`,
          '',
          'The regex parser produced:',
          JSON.stringify(stripLocal(local)),
          ...(tagVocabulary.length
            ? ['', `The user's existing tags: ${tagVocabulary.join(', ')}`]
            : []),
        ].join('\n'),
      },
    ],
  })

  // Start from the local parse: the raw transcript and dateMet are ours to
  // keep (the date met is today by definition), and every field below only
  // overrides what the regex produced if the model actually returned it.
  const parsed: ParsedCapture = { ...local }
  const changes: CaptureChange[] = []

  function apply<K extends keyof ParsedCapture>(
    key: K,
    next: ParsedCapture[K] | undefined,
  ) {
    if (next === undefined) return
    const before = local[key]
    // An empty tag list reads as "nothing there", not as a value AI overwrote.
    const had = Array.isArray(before) ? before.length > 0 : before !== undefined
    if (had && humanize(key, before) === humanize(key, next)) return
    parsed[key] = next as ParsedCapture[K]
    changes.push({
      key,
      label: FIELD_LABELS[key] ?? key,
      from: had && !DIFF_HIDES_PREVIOUS.has(key) ? humanize(key, before) : undefined,
      to: humanize(key, next),
    })
  }

  for (const key of TEXT_KEYS) apply(key, cleanText(raw[key], key === 'linkedinUrl' ? 200 : 80))
  apply('connectionType', pickEnum(raw.connectionType, CONNECTION_TYPE_KEYS))
  apply('source', pickEnum(raw.source, MEET_SOURCE_KEYS))
  apply('contactFrequencyGoal', pickEnum(raw.contactFrequencyGoal, FREQUENCY_KEYS))

  // The note is the one thing here that's prose rather than a field, so it
  // gets a prose-sized budget — and only replaces the transcript if the model
  // actually returned something.
  apply('notes', cleanText(raw.notes, 600))

  const tagNames = Array.isArray(raw.tagNames)
    ? raw.tagNames
        .map((t) => cleanText(t, 24))
        .filter((t): t is string => Boolean(t))
        .slice(0, MAX_TAGS_PER_CONTACT)
    : undefined
  if (tagNames?.length) apply('tagNames', tagNames)

  return { parsed, changes }
}

/** What the model sees of the local parse — fields, not bookkeeping. */
function stripLocal(local: ParsedCapture): Record<string, unknown> {
  const { transcript: _transcript, notes: _notes, dateMet: _dateMet, ...fields } = local
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== undefined,
    ),
  )
}
