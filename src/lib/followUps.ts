import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns'
import type { FollowUp } from '@/types'

/**
 * Everything about a follow-up's date that isn't storage: reading one out of
 * a sentence ("email her back in December"), saying when one is due in words,
 * and the quick choices a picker offers. Pure functions of `today`, so they
 * behave the same in a test as on a phone at 11:59pm.
 */

export const toISODate = (d: Date): string => format(d, 'yyyy-MM-dd')

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type FollowUpState = 'done' | 'overdue' | 'today' | 'soon' | 'later'

/** How many days until it's due — negative once it's late. */
export function daysUntilDue(dueDate: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(dueDate), startOfDay(today))
}

export function followUpState(f: FollowUp, today: Date = new Date()): FollowUpState {
  if (f.completedAt) return 'done'
  const days = daysUntilDue(f.dueDate, today)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 7) return 'soon'
  return 'later'
}

/** Open and due today or earlier — what the dashboard and badges count. */
export function isDue(f: FollowUp, today: Date = new Date()): boolean {
  const state = followUpState(f, today)
  return state === 'overdue' || state === 'today'
}

/** "Today", "Tomorrow", "3 days late", "In 5 days", "Dec 1", "Dec 1, 2027". */
export function describeDue(dueDate: string, today: Date = new Date()): string {
  const days = daysUntilDue(dueDate, today)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${-days} days late`
  if (days <= 6) return format(parseISO(dueDate), 'EEEE')
  const date = parseISO(dueDate)
  return date.getFullYear() === today.getFullYear()
    ? format(date, 'MMM d')
    : format(date, 'MMM d, yyyy')
}

/** `describeDue` for the middle of a sentence: "for tomorrow", "for Dec 1". */
export function dueInSentence(dueDate: string, today: Date = new Date()): string {
  const words = describeDue(dueDate, today)
  return /^(Today|Tomorrow|Yesterday)$/.test(words) ? words.toLowerCase() : words
}

/** Open ones first by date, then finished ones most-recent first. */
export function sortFollowUps(items: FollowUp[]): FollowUp[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.completedAt) !== Boolean(b.completedAt)) return a.completedAt ? 1 : -1
    if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt)
    return a.dueDate.localeCompare(b.dueDate)
  })
}

// ---------------------------------------------------------------------------
// Quick choices
// ---------------------------------------------------------------------------

export interface DateChoice {
  label: string
  date: string
}

/** The shortcuts a date picker offers before "pick a date". */
export function quickDates(today: Date = new Date()): DateChoice[] {
  const base = startOfDay(today)
  return [
    { label: 'Tomorrow', date: toISODate(addDays(base, 1)) },
    { label: 'Next week', date: toISODate(addDays(base, 7)) },
    { label: 'In 2 weeks', date: toISODate(addDays(base, 14)) },
    { label: 'Next month', date: toISODate(addMonths(base, 1)) },
    { label: 'In 3 months', date: toISODate(addMonths(base, 3)) },
  ]
}

/** Pushing a due follow-up back. Counted from today, not the old due date. */
export function snoozeChoices(today: Date = new Date()): DateChoice[] {
  const base = startOfDay(today)
  return [
    { label: 'Tomorrow', date: toISODate(addDays(base, 1)) },
    { label: 'In 3 days', date: toISODate(addDays(base, 3)) },
    { label: 'Next week', date: toISODate(addDays(base, 7)) },
    { label: 'Next month', date: toISODate(addMonths(base, 1)) },
  ]
}

// ---------------------------------------------------------------------------
// Reading a date out of a sentence
// ---------------------------------------------------------------------------

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
]
const MONTH_RE =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const WEEKDAY_RE = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?'

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, few: 3,
}

function monthIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  return MONTHS.findIndex((m) => m.startsWith(w))
}

function weekdayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  return WEEKDAYS.findIndex((d) => d.startsWith(w))
}

function count(word: string): number | undefined {
  const w = word.toLowerCase()
  return /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w]
}

/**
 * The next time `month` (0-based) comes round. The current month only counts
 * when a day is given that hasn't passed — "email back in September", said in
 * September, means next year.
 */
function nextMonthDate(month: number, day: number | 'end', today: Date, explicitDay: boolean): Date {
  const base = startOfDay(today)
  let year = base.getFullYear()
  const build = (y: number) => {
    const first = new Date(y, month, 1)
    if (day === 'end') return endOfMonth(first)
    return new Date(y, month, Math.min(day, endOfMonth(first).getDate()))
  }
  let candidate = build(year)
  const sameMonth = month === base.getMonth()
  if (candidate < base || (sameMonth && !explicitDay && day !== 'end')) {
    year += 1
    candidate = build(year)
  }
  return candidate
}

export interface ParsedDate {
  /** yyyy-mm-dd */
  date: string
  /** The words that said it, as they appeared — so a caller can cut them out. */
  phrase: string
}

type Rule = (text: string, today: Date) => ParsedDate | null

const rules: Rule[] = [
  // "in 3 weeks", "in a couple of months", "in two days"
  (text, today) => {
    const m = text.match(
      /\b(?:in|within|after)\s+(?:about\s+|around\s+)?(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|(?:a\s+)?couple(?:\s+of)?|(?:a\s+)?few)\s+(day|week|month|year)s?\b/i,
    )
    if (!m) return null
    const n = count(m[1].replace(/^a\s+/i, '').replace(/\s+of$/i, ''))
    if (!n) return null
    const base = startOfDay(today)
    const unit = m[2].toLowerCase()
    const date =
      unit === 'day'
        ? addDays(base, n)
        : unit === 'week'
          ? addDays(base, n * 7)
          : unit === 'month'
            ? addMonths(base, n)
            : addMonths(base, n * 12)
    return { date: toISODate(date), phrase: m[0] }
  },

  // "tomorrow", "the day after tomorrow"
  (text, today) => {
    const m = text.match(/\b(?:the\s+)?(day\s+after\s+)?tomorrow\b/i)
    if (!m) return null
    return { date: toISODate(addDays(startOfDay(today), m[1] ? 2 : 1)), phrase: m[0] }
  },

  // "end of the week", "this weekend", "end of the month", "end of the year"
  (text, today) => {
    const m = text.match(/\b(?:by\s+|at\s+)?(?:the\s+)?(end\s+of\s+(?:the\s+|this\s+)?(week|month|year)|this\s+weekend|the\s+weekend)\b/i)
    if (!m) return null
    const base = startOfDay(today)
    let date: Date
    if (/weekend/i.test(m[1])) date = addDays(base, (6 - base.getDay() + 7) % 7 || 7)
    else if (m[2]?.toLowerCase() === 'week') date = addDays(base, (5 - base.getDay() + 7) % 7 || 7)
    else if (m[2]?.toLowerCase() === 'month') date = endOfMonth(base)
    else date = new Date(base.getFullYear(), 11, 31)
    return { date: toISODate(date), phrase: m[0] }
  },

  // "next week", "next month", "next year"
  (text, today) => {
    const m = text.match(/\bnext\s+(week|month|year)\b/i)
    if (!m) return null
    const base = startOfDay(today)
    const unit = m[1].toLowerCase()
    const date =
      unit === 'week'
        ? addDays(base, 7)
        : unit === 'month'
          ? new Date(base.getFullYear(), base.getMonth() + 1, 1)
          : new Date(base.getFullYear() + 1, 0, 1)
    return { date: toISODate(date), phrase: m[0] }
  },

  // "on Dec 15", "by December 15th", "December 3rd", "mid-December", "early Jan", "end of March", "after December"
  (text, today) => {
    const withDay = text.match(
      new RegExp(`\\b(?:(?:on|by|before|around|until|till|til)\\s+)?(?:the\\s+)?${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'),
    )
    if (withDay) {
      const month = monthIndex(withDay[1])
      const day = Number(withDay[2])
      if (month >= 0 && day >= 1 && day <= 31) {
        return { date: toISODate(nextMonthDate(month, day, today, true)), phrase: withDay[0] }
      }
    }
    const dayFirst = text.match(
      new RegExp(`\\b(?:(?:on|by|before)\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'i'),
    )
    if (dayFirst) {
      const month = monthIndex(dayFirst[2])
      const day = Number(dayFirst[1])
      if (month >= 0 && day >= 1 && day <= 31) {
        return { date: toISODate(nextMonthDate(month, day, today, true)), phrase: dayFirst[0] }
      }
    }
    // A bare month needs something in front of it: "may" is also a verb.
    const bare = text.match(
      new RegExp(
        `\\b(in|by|around|after|until|till|til|come|this|next|early|mid|late|end\\s+of|beginning\\s+of|start\\s+of)(?:\\s+|-)(?:the\\s+)?${MONTH_RE}\\b`,
        'i',
      ),
    )
    if (!bare) return null
    const month = monthIndex(bare[2])
    if (month < 0) return null
    const lead = bare[1].toLowerCase().replace(/\s+/g, ' ')
    if (lead === 'after') {
      const after = nextMonthDate(month, 'end', today, false)
      return { date: toISODate(addDays(after, 1)), phrase: bare[0] }
    }
    const day: number | 'end' =
      lead === 'mid' ? 15 : lead === 'late' ? 24 : lead === 'end of' ? 'end' : 1
    return { date: toISODate(nextMonthDate(month, day, today, false)), phrase: bare[0] }
  },

  // "12/15", "on 12/15/2026"
  (text, today) => {
    const m = text.match(/\b(?:on\s+|by\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
    if (!m) return null
    const month = Number(m[1]) - 1
    const day = Number(m[2])
    if (month < 0 || month > 11 || day < 1 || day > 31) return null
    if (m[3]) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      const date = new Date(year, month, day)
      if (!isValid(date) || date < startOfDay(today)) return null
      return { date: toISODate(date), phrase: m[0] }
    }
    return { date: toISODate(nextMonthDate(month, day, today, true)), phrase: m[0] }
  },

  // "on Monday", "next Friday", "this Thursday", "by Wednesday"
  (text, today) => {
    const m = text.match(new RegExp(`\\b(on|next|this|by|coming)\\s+${WEEKDAY_RE}\\b`, 'i'))
    if (!m) return null
    const target = weekdayIndex(m[2])
    if (target < 0) return null
    const base = startOfDay(today)
    let ahead = (target - base.getDay() + 7) % 7 || 7
    // "next Friday" said on a Monday means the Friday after this one.
    if (m[1].toLowerCase() === 'next' && ahead < 7 && base.getDay() !== 0 && target > base.getDay()) {
      ahead += 7
    }
    return { date: toISODate(addDays(base, ahead)), phrase: m[0] }
  },

  // Seasons and the turn of the year.
  (text, today) => {
    const m = text.match(
      /\b(?:(?:in|by|after|around|this|next)\s+(?:the\s+)?)(spring|summer|fall|autumn|winter|new\s+year|holidays|winter\s+break|spring\s+break)\b/i,
    )
    if (!m) return null
    const key = m[1].toLowerCase().replace(/\s+/g, ' ')
    const start: Record<string, [number, number]> = {
      spring: [2, 1],
      'spring break': [2, 1],
      summer: [5, 1],
      fall: [8, 1],
      autumn: [8, 1],
      winter: [11, 1],
      'winter break': [11, 15],
      'new year': [0, 2],
      holidays: [0, 5],
    }
    const [month, day] = start[key]
    return { date: toISODate(nextMonthDate(month, day, today, false)), phrase: m[0] }
  },
]

/** The first date a sentence names, resolved from `today`. */
export function parseDatePhrase(text: string, today: Date = new Date()): ParsedDate | null {
  for (const rule of rules) {
    const hit = rule(text, today)
    if (hit) return hit
  }
  return null
}

/**
 * Phrases that are a follow-up on their own — "follow up", "reach out" —
 * and so still count when no date is given.
 */
const STRONG_VERB =
  /\b(follow(?:\s|-)?up|reach\s+(?:back\s+)?out|get\s+back\s+to|circle\s+back|check\s+in|touch\s+base|reconnect|remind\s+me)\b/i

/**
 * Contact verbs only count with someone on the other end: "email her back"
 * is a promise, "she works in email marketing" is not.
 */
const WEAK_VERB = new RegExp(
  `\\b(?:(?:${anyCase('email|e-mail|text|call|message|dm|ping|write to|reply to|introduce|intro')})\\s+(?:${anyCase('her|him|them|back')}|\\p{Lu}\\w*)|${anyCase('send')}\\s+(?:${anyCase('her|him|them')}|\\p{Lu}\\w*))\\b`,
  'u',
)

/**
 * Case-insensitive letters without the `i` flag, which would also make the
 * capitalised-name check (`\p{Lu}`) match any word at all.
 */
function anyCase(words: string): string {
  return words
    .replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`)
    .replace(/ /g, '\\s+')
}

const FOLLOW_UP_VERB = new RegExp(`${STRONG_VERB.source}|${WEAK_VERB.source}`, 'iu')

/** Words that make it a standing cadence rather than a one-off. */
const RECURRING = /\b(every|each)\s+(\w+\s+)?(day|week|month|quarter|year|months|weeks)\b|\b(weekly|monthly|quarterly|yearly|annually|biweekly)\b/i

export interface ExtractedFollowUp {
  dueDate: string
  note?: string
}

/**
 * A follow-up promise inside a longer sentence about someone:
 * "…she said to email her back in December about the internship" →
 * due Dec 1, "Email her back about the internship".
 *
 * Only fires when a follow-up verb and a date sit in the same clause, and
 * never for a recurring phrase ("every month"), which is a cadence.
 * `fallbackDays` is used when the verb is there but no date is.
 */
export function extractFollowUp(
  text: string,
  today: Date = new Date(),
  { fallbackDays }: { fallbackDays?: number } = {},
): ExtractedFollowUp | null {
  const clauses = text
    .split(/(?<=[.;!?])\s+|\s*;\s*|\s+—\s+|\s+-\s+/)
    .map((c) => c.trim())
    .filter(Boolean)

  for (const clause of clauses) {
    const strong = STRONG_VERB.test(clause)
    if ((!strong && !WEAK_VERB.test(clause)) || RECURRING.test(clause)) continue
    const parsed = parseDatePhrase(clause, today)
    if (!parsed && (fallbackDays === undefined || !strong)) continue
    // Past or today only happens for an explicit year in the past; skip it.
    if (parsed && daysUntilDue(parsed.date, today) < 0) continue
    const dueDate = parsed?.date ?? toISODate(addDays(startOfDay(today), fallbackDays ?? 7))
    return { dueDate, note: noteFrom(clause, parsed?.phrase) }
  }
  return null
}

/** The clause as a to-do: date cut out, "she said to" cut off, capitalised. */
function noteFrom(clause: string, phrase?: string): string | undefined {
  let s = phrase ? clause.replace(phrase, ' ') : clause
  const verb = s.search(FOLLOW_UP_VERB)
  // Start the note at the promise: "…at Fidelity and I should email her back" → "email her back".
  if (verb > 0) {
    const before = s.slice(0, verb)
    const lead = before.match(
      /(?:^|\b)(?:(?:she|he|they|i)\s+(?:said|told\s+me|asked\s+me|wants\s+me|needs?\s+me|should|need\s+to|have\s+to|will|'ll|gotta)\s*(?:to\s+)?|remind\s+me\s+to\s+|need\s+to\s+|have\s+to\s+|should\s+|to\s+)$/i,
    )
    s = lead ? s.slice(verb) : s.slice(Math.max(0, before.lastIndexOf(',') + 1))
  }
  s = s
    .replace(/^\s*remind\s+me\s+to\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .replace(/\s+(?:and|but|so)$/i, '')
    .trim()
  if (!s || s.length > 140) return undefined
  return s[0].toUpperCase() + s.slice(1)
}
