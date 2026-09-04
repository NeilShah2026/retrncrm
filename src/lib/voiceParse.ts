/**
 * Turns one spoken (or typed) sentence about a person into a contact draft.
 *
 * The whole point is that adding someone should cost one sentence, not a
 * twenty-field form — so this runs entirely in the browser: no API, no key,
 * no cost, and nothing about the person leaves the app. It's heuristic by
 * design; every field it finds is shown for confirmation before saving.
 *
 * "Met Sarah Chen at the career fair — she's a PM at Fidelity, Babson alum,
 *  class of 2022. Follow up in a month."
 */

import { todayISO } from './format'
import { CONNECTION_TYPES, MEET_SOURCES } from './constants'
import type { ConnectionType, ContactFrequency, MeetSource } from '@/types'

export interface ParsedCapture {
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  school?: string
  gradYear?: string
  major?: string
  connectionType?: ConnectionType
  source?: MeetSource
  whereWeMet?: string
  howWeMet?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  contactFrequencyGoal?: ContactFrequency
  dateMet?: string
  /** Tag names (not ids) — resolved or created at save time. */
  tagNames: string[]
  /** The sentence itself, kept as the contact's notes. */
  notes?: string
  /** The raw transcript, verbatim. */
  transcript: string
}

/** One extracted field, for the review chips in the capture UI. */
export interface CaptureField {
  key: keyof ParsedCapture
  label: string
  /** Display value (enums already humanized). */
  value: string
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Title words that let us recognise a title even without "at <company>". */
const TITLE_WORDS = [
  'ceo', 'cto', 'coo', 'cfo', 'cmo', 'vp', 'svp', 'evp', 'pm', 'apm', 'tpm',
  'engineer', 'developer', 'designer', 'analyst', 'associate', 'consultant',
  'manager', 'director', 'partner', 'principal', 'president', 'founder',
  'cofounder', 'co-founder', 'recruiter', 'professor', 'lecturer', 'teacher',
  'scientist', 'researcher', 'intern', 'accountant', 'attorney', 'lawyer',
  'banker', 'trader', 'marketer', 'strategist', 'advisor', 'adviser', 'coach',
  'nurse', 'doctor', 'architect', 'producer', 'editor', 'writer', 'realtor',
  'head', 'lead', 'chief', 'officer', 'specialist', 'coordinator', 'agent',
]

/** Spoken shorthand a listener would expand automatically. */
const TITLE_EXPANSIONS: Record<string, string> = {
  pm: 'Product Manager',
  apm: 'Associate Product Manager',
  tpm: 'Technical Program Manager',
  swe: 'Software Engineer',
  sde: 'Software Engineer',
  ds: 'Data Scientist',
  ib: 'Investment Banker',
  ceo: 'CEO',
  cto: 'CTO',
  coo: 'COO',
  cfo: 'CFO',
  cmo: 'CMO',
  vp: 'VP',
}

/** Phrases that imply how a person relates to you. */
const CONNECTION_PHRASES: [RegExp, ConnectionType][] = [
  [/\b(recruiter|recruiting|talent acquisition|hiring manager)\b/i, 'recruiter'],
  [/\b(professor|prof|lecturer|dean|faculty)\b/i, 'professor'],
  [/\b(alum|alumna|alumnus|alumni)\b/i, 'alumni'],
  [/\b(classmate|in my class|same class|study group|lab partner)\b/i, 'classmate'],
  [/\b(co-?founder|founder)\b/i, 'founder'],
  [/\b(mentor|advisor|adviser|coach)\b/i, 'mentor'],
  [/\b(investor|angel investor|venture capital|vc)\b/i, 'investor'],
  [/\b(colleague|coworker|co-?worker|teammate)\b/i, 'peer'],
]

/** Phrases that imply where you met. Most specific first. */
const SOURCE_PHRASES: [RegExp, MeetSource][] = [
  [/\b(career fair|job fair|careers fair)\b/i, 'career-fair'],
  [/\b(info ?session|information session|company presentation)\b/i, 'info-session'],
  [/\b(guest lecture|guest speaker|speaker series|fireside)\b/i, 'guest-lecture'],
  [/\b(hackathon|hack ?night|datathon|case competition)\b/i, 'hackathon'],
  [/\b(coffee chat|over coffee|grabbed coffee|coffee with)\b/i, 'coffee-chat'],
  [/\b(networking (?:event|night|mixer)|mixer|meetup|conference|summit|panel)\b/i, 'networking-event'],
  [/\b(club|society|fraternity|sorority|student org(?:anization)?)\b/i, 'club'],
  [/\b(in class|during class|lecture|seminar)\b/i, 'class'],
  [/\b(referred|referral|introduced (?:by|me)|intro from|connected me)\b/i, 'referral'],
  [/\b(on the (?:plane|flight|bus|train|subway)|at the airport|while travel(?:l)?ing|on a flight)\b/i, 'travel'],
  [/\b(over (?:zoom|email|linkedin|twitter|discord|slack)|on (?:linkedin|twitter|discord|slack|reddit))\b/i, 'online'],
]

/** "follow up in a month" → a cadence goal. */
const CADENCE_PHRASES: [RegExp, ContactFrequency][] = [
  [/\b(?:every|each) week\b|\bweekly\b|\bin a week\b/i, 'weekly'],
  [/\b(?:every|each) month\b|\bmonthly\b|\bin a month\b|\bin (?:four|4) weeks\b/i, 'monthly'],
  [/\b(?:every|each) (?:quarter|(?:three|3) months)\b|\bquarterly\b|\bin (?:three|3) months\b/i, 'quarterly'],
  [/\b(?:every|each) (?:six|6) months\b|\btwice a year\b|\bin (?:six|6) months\b/i, 'biannually'],
  [/\b(?:every|each) year\b|\byearly\b|\bannually\b|\bin a year\b/i, 'annually'],
]

/** Capitalised words that still can't be part of a person's name. */
const NAME_STOPWORDS = new Set([
  'i', 'me', 'my', 'we', 'he', 'she', 'they', 'his', 'her', 'their', 'the',
  'a', 'an', 'at', 'in', 'on', 'from', 'with', 'and', 'but', 'met', 'meet',
  'meeting', 'talked', 'spoke', 'today', 'yesterday', 'tonight', 'this',
  'that', 'was', 'is', 'who', 'works', 'work', 'working', 'named', 'name',
  'guy', 'girl', 'woman', 'man', 'person', 'someone', 'add', 'new', 'contact',
  'about', 'after', 'before', 'during', 'really', 'super', 'very', 'also',
  'just', 'so', 'okay', 'ok', 'um', 'uh', 'coffee', 'lunch', 'dinner',
  'drinks', 'breakfast', 'hey', 'hi', 'hello', 'chatted', 'sat', 'ran',
  'into', 'next', 'beside', 'grabbed', 'got',
])

/** Titles of address that get stripped off the front of a spoken name. */
const HONORIFICS = new Set([
  'professor', 'prof', 'dr', 'doctor', 'mr', 'mrs', 'ms', 'miss', 'dean',
  'coach', 'sir', 'madam',
])

/** Verbs and connectors that mark the end of a company or school name. */
const TRAILING_CLAUSE =
  /\s+(?:and|but|who|which|she|he|they|we|i|it|is|was|has|had|last|this|next|then|really|super|very|also|about|for|going|used|wants|said|told|asked|gave|mentioned|studying|studied|majoring|graduating|graduated|class|follow|reach|reconnect|check|ping|email|text|call|message|down|great|nice|cool|interested|tag)\b[\s\S]*$/i

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) =>
      w.length <= 3 && /^[A-Z]+$/.test(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ')
}

/** Trim a captured span down to the entity itself, dropping the clause after. */
function clampEntity(raw: string, maxWords = 5): string {
  const s = raw
    .replace(TRAILING_CLAUSE, '')
    .replace(/[.,;:!?—–-]+\s*$/, '')
    .trim()
  return s.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ')
}

function expandTitle(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\./g, '')
  if (TITLE_EXPANSIONS[key]) return TITLE_EXPANSIONS[key]
  const expanded = raw
    .split(/\s+/)
    .map((w) => TITLE_EXPANSIONS[w.toLowerCase().replace(/\./g, '')] ?? w)
    .join(' ')
  return titleCase(expanded.replace(/^(?:a|an|the)\s+/i, '').trim())
}

/** Dictation writes "sarah at gmail dot com" — put the address back together. */
function normalizeSpokenEmail(text: string): string {
  // Rebuild the whole address in one pass so the local part keeps its dots:
  // "jordan dot blake at gmail dot com" → "jordan.blake@gmail.com".
  return text.replace(
    /\b([\w+-]+(?:\s+dot\s+[\w+-]+)*)\s+at\s+([\w-]+(?:\s+dot\s+[\w-]+)*)\s+dot\s+(com|org|net|edu|io|co|gov)\b/gi,
    (_match, local: string, domain: string, tld: string) =>
      `${local.replace(/\s+dot\s+/gi, '.')}@${domain.replace(/\s+dot\s+/gi, '.')}.${tld}`,
  )
}

function looksLikeNameWord(word: string): boolean {
  const bare = word.replace(/[^\p{L}'’-]/gu, '')
  if (bare.length < 2) return false
  if (NAME_STOPWORDS.has(bare.toLowerCase())) return false
  return /^\p{Lu}/u.test(bare)
}

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

const NAME_RUN = String.raw`[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2}`

const NAME_LEAD_INS = [
  new RegExp(
    String.raw`\b(?:i\s+)?(?:just\s+)?met\s+(?:a\s+(?:guy|girl|woman|man|person)\s+(?:named|called)\s+)?(${NAME_RUN})`,
    'u',
  ),
  new RegExp(String.raw`\b(?:named|called)\s+(${NAME_RUN})`, 'u'),
  new RegExp(
    String.raw`\b(?:this is|that was|talked to|spoke (?:to|with)|introduced to|add|new contact)\s+(${NAME_RUN})`,
    'u',
  ),
  new RegExp(
    String.raw`\b(?:coffee|lunch|dinner|drinks|chatted|chatting|sat next to|ran into|grabbed coffee)\s+with\s+(${NAME_RUN})`,
    'u',
  ),
]

/**
 * Dictation doesn't always capitalise a name ("met tom from Wayfair"), so as a
 * last resort trust an explicit lead-in and take the word after it as spoken.
 */
const LOWERCASE_LEAD_IN = new RegExp(
  String.raw`\b(?:met|named|called|add|talked to|spoke (?:to|with)|coffee with)\s+([\p{L}'’-]{2,}(?:\s+[\p{L}'’-]{2,})?)`,
  'u',
)

/**
 * The name is the one field worth being careful about — everything else can
 * be missing and the contact is still useful. Explicit lead-ins ("met X",
 * "add X", "a guy named X") are trusted first; otherwise take the first run of
 * capitalised words that isn't sentence-opening noise.
 */
function extractName(text: string): { firstName?: string; lastName?: string } {
  let candidate: string | undefined
  for (const re of NAME_LEAD_INS) {
    const m = text.match(re)
    if (m?.[1]) {
      candidate = m[1]
      break
    }
  }

  if (!candidate) {
    const words = text.split(/\s+/)
    const run: string[] = []
    for (let i = 0; i < words.length && run.length < 3; i++) {
      const w = words[i]
      if (looksLikeNameWord(w)) {
        run.push(w.replace(/[^\p{L}'’-]/gu, ''))
        if (/[.,;:!?]$/.test(w)) break
      } else if (run.length) {
        break
      }
    }
    if (run.length) candidate = run.join(' ')
  }

  if (!candidate) {
    const m = text.match(LOWERCASE_LEAD_IN)
    if (m?.[1]) candidate = m[1]
  }

  if (!candidate) return {}

  const parts = candidate
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}'’-]/gu, ''))
    .filter(
      (p) =>
        p &&
        !NAME_STOPWORDS.has(p.toLowerCase()) &&
        !HONORIFICS.has(p.toLowerCase().replace(/\.$/, '')),
    )
  if (parts.length === 0) return {}
  return {
    firstName: titleCase(parts[0]),
    lastName: parts.length > 1 ? titleCase(parts.slice(1).join(' ')) : undefined,
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseSpokenContact(input: string): ParsedCapture {
  const transcript = input.replace(/\s+/g, ' ').trim()
  const result: ParsedCapture = { tagNames: [], transcript }
  if (!transcript) return result

  const text = normalizeSpokenEmail(transcript)

  // --- channels -----------------------------------------------------------
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  if (email) result.email = email[0].toLowerCase().replace(/[.,]$/, '')

  const phone = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/)
  if (phone) result.phone = phone[0].trim()

  const li = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s,]+/i)
  if (li) result.linkedinUrl = li[0].startsWith('http') ? li[0] : `https://${li[0]}`

  // --- name ---------------------------------------------------------------
  Object.assign(result, extractName(text))

  // --- school, graduation, major -----------------------------------------
  const school = text.match(
    /\b(?:goes to|studies at|student at|studying at|attends?|from)\s+((?:the\s+)?University(?:\s+of\s+[\p{Lu}][\p{L}]+)?|[\p{Lu}][\p{L}&.'-]*(?:\s+[\p{Lu}][\p{L}&.'-]*){0,3}\s+(?:University|College|Institute|Tech|State|School))\b/u,
  )
  if (school) result.school = clampEntity(school[1], 6)

  const alum = text.match(
    /\b([\p{Lu}][\p{L}&.'-]*(?:\s+[\p{Lu}][\p{L}&.'-]*){0,2})\s+(?:alum|alumna|alumnus|alumni|grad)\b/u,
  )
  if (alum && !result.school) result.school = clampEntity(alum[1], 4)

  const gradYear = text.match(
    /\b(?:class of|graduat(?:es|ed|ing)(?:\s+in)?|c\/o)\s+('?\d{2}|\d{4})\b/i,
  )
  if (gradYear) {
    const y = gradYear[1].replace(/'/, '')
    result.gradYear = y.length === 2 ? `20${y}` : y
  }

  const major = text.match(
    /\b(?:major(?:ing|s)?(?:\s+in)?|degree in)\s+([\p{L}\s]{3,30}?)(?=[.,;]|\s+(?:and|at|who|she|he|they|it|is|was)\b|$)/iu,
  )
  if (major) {
    const m = clampEntity(major[1], 3)
    if (m && m.toLowerCase() !== result.school?.toLowerCase()) {
      result.major = titleCase(m)
    }
  }

  // --- title + company ----------------------------------------------------
  const titleAt = text.match(
    new RegExp(
      String.raw`\b(?:(?:is|was|she'?s|he'?s|they'?re)\s+)?(?:an?\s+|the\s+)?([\p{L}\s/&-]{2,40}?)\s+(?:at|@|for|with)\s+([\p{Lu}][\p{L}&.'’-]*(?:\s+[\p{Lu}\d][\p{L}&.'’-]*){0,3})`,
      'u',
    ),
  )
  if (titleAt) {
    const rawTitle = titleAt[1].trim()
    const isTitle =
      TITLE_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(rawTitle)) ||
      Boolean(TITLE_EXPANSIONS[rawTitle.toLowerCase()])
    if (isTitle) {
      result.jobTitle = expandTitle(rawTitle)
      result.company = clampEntity(titleAt[2], 4)
    }
  }

  if (!result.company) {
    const worksAt = text.match(
      /\b(?:works?|working|employed|interns?|interning)\s+(?:at|for|with)\s+([\p{Lu}][\p{L}&.'’-]*(?:\s+[\p{Lu}\d][\p{L}&.'’-]*){0,3})/u,
    )
    if (worksAt) result.company = clampEntity(worksAt[1], 4)
  }

  if (!result.jobTitle) {
    const bare = text.match(
      new RegExp(
        String.raw`\b(?:is|was|she'?s|he'?s|they'?re)\s+(?:an?\s+|the\s+)?((?:senior|junior|associate|lead|head|chief|principal|staff)?\s*(?:${TITLE_WORDS.join('|')}))\b`,
        'i',
      ),
    )
    if (bare) result.jobTitle = expandTitle(bare[1])
  }

  // Never let the same string sit in both company and school.
  if (
    result.company &&
    result.school &&
    result.company.toLowerCase() === result.school.toLowerCase()
  ) {
    result.school = undefined
  }

  // --- how and where we met ----------------------------------------------
  for (const [re, source] of SOURCE_PHRASES) {
    const m = text.match(re)
    if (m) {
      result.source = source
      result.howWeMet = m[0].trim()
      break
    }
  }

  const place = text.match(
    /\b(?:at|during|on)\s+(?:the\s+)?([\p{Lu}][\p{L}&.'’-]*(?:\s+[\p{L}&.'’-]+){0,3}\s+(?:fair|conference|summit|event|mixer|hackathon|meetup|night|panel|session|party|gala|expo))\b/u,
  )
  if (place) result.whereWeMet = clampEntity(place[1], 5)

  // --- relationship -------------------------------------------------------
  for (const [re, type] of CONNECTION_PHRASES) {
    if (re.test(text)) {
      result.connectionType = type
      break
    }
  }
  if (!result.connectionType && /\brecruiter\b/i.test(result.jobTitle ?? '')) {
    result.connectionType = 'recruiter'
  }

  // --- cadence ------------------------------------------------------------
  for (const [re, freq] of CADENCE_PHRASES) {
    if (re.test(text)) {
      result.contactFrequencyGoal = freq
      break
    }
  }
  if (
    !result.contactFrequencyGoal &&
    /\b(?:follow(?:\s|-)?up|reconnect|reach out|check in|ping|circle back|touch base)\b/i.test(
      text,
    )
  ) {
    result.contactFrequencyGoal = 'monthly'
  }

  // --- tags ---------------------------------------------------------------
  const tagPhrase = text.match(
    /\btags?\s+(?:(?:him|her|them|it|this)\s+)?(?:as\s+|with\s+)?([\p{L}\s,]+?)(?=[.;]|$)/iu,
  )
  if (tagPhrase) {
    result.tagNames = tagPhrase[1]
      .split(/\s*(?:,|\band\b)\s*/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && t.length < 24)
      .map(titleCase)
  }

  // --- context ------------------------------------------------------------
  result.dateMet = todayISO()
  // The sentence itself is usually the best "how we met" note there is.
  result.notes = transcript

  return result
}

/** The recognised fields, formatted for the review chips. */
export function captureFields(p: ParsedCapture): CaptureField[] {
  const out: CaptureField[] = []
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ')
  if (name) out.push({ key: 'firstName', label: 'Name', value: name })
  if (p.jobTitle) out.push({ key: 'jobTitle', label: 'Title', value: p.jobTitle })
  if (p.company) out.push({ key: 'company', label: 'Company', value: p.company })
  if (p.school) out.push({ key: 'school', label: 'School', value: p.school })
  if (p.gradYear) out.push({ key: 'gradYear', label: 'Class of', value: p.gradYear })
  if (p.major) out.push({ key: 'major', label: 'Major', value: p.major })
  if (p.connectionType) {
    out.push({
      key: 'connectionType',
      label: 'Relationship',
      value: CONNECTION_TYPES[p.connectionType].label,
    })
  }
  if (p.source) {
    out.push({ key: 'source', label: 'Met at', value: MEET_SOURCES[p.source].label })
  }
  if (p.whereWeMet) out.push({ key: 'whereWeMet', label: 'Where', value: p.whereWeMet })
  if (p.email) out.push({ key: 'email', label: 'Email', value: p.email })
  if (p.phone) out.push({ key: 'phone', label: 'Phone', value: p.phone })
  if (p.linkedinUrl) out.push({ key: 'linkedinUrl', label: 'LinkedIn', value: 'profile' })
  if (p.contactFrequencyGoal && p.contactFrequencyGoal !== 'none') {
    out.push({
      key: 'contactFrequencyGoal',
      label: 'Follow up',
      value: p.contactFrequencyGoal,
    })
  }
  for (const t of p.tagNames) out.push({ key: 'tagNames', label: 'Tag', value: t })
  return out
}
