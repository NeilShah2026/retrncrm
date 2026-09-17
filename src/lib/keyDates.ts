import { differenceInCalendarDays, format, startOfDay } from 'date-fns'
import type { KeyDate } from '@/types'

/** The labels offered first; anything else can be typed. */
export const KEY_DATE_LABELS = ['Birthday', 'Work anniversary', 'Graduation', 'Anniversary'] as const

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
]

/** Days in a month, with February allowed its 29th (a leap-day birthday is real). */
export function daysInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31
}

/**
 * The next time this date comes round, today included. A 29 February date
 * lands on the 28th in a year without one.
 */
export function nextOccurrence(k: Pick<KeyDate, 'month' | 'day'>, today: Date = new Date()): Date {
  const base = startOfDay(today)
  const at = (year: number) => {
    const last = new Date(year, k.month, 0).getDate()
    return new Date(year, k.month - 1, Math.min(k.day, last))
  }
  const thisYear = at(base.getFullYear())
  return thisYear >= base ? thisYear : at(base.getFullYear() + 1)
}

export function daysUntilKeyDate(k: Pick<KeyDate, 'month' | 'day'>, today: Date = new Date()): number {
  return differenceInCalendarDays(nextOccurrence(k, today), startOfDay(today))
}

/** "March 14" or "March 14, 1998". */
export function formatKeyDate(k: Pick<KeyDate, 'month' | 'day' | 'year'>): string {
  const md = `${MONTH_NAMES[k.month - 1]} ${k.day}`
  return k.year ? `${md}, ${k.year}` : md
}

/**
 * How many years the next occurrence marks — "turns 25", "5 years" — when a
 * year is known. Undefined otherwise.
 */
export function yearsAt(k: Pick<KeyDate, 'month' | 'day' | 'year'>, today: Date = new Date()): number | undefined {
  if (!k.year) return undefined
  const years = nextOccurrence(k, today).getFullYear() - k.year
  return years > 0 ? years : undefined
}

/** "Turns 25", "5 years", or nothing. */
export function milestone(k: KeyDate, today: Date = new Date()): string | undefined {
  const years = yearsAt(k, today)
  if (!years) return undefined
  return /birthday/i.test(k.label) ? `Turns ${years}` : `${years} ${years === 1 ? 'year' : 'years'}`
}

/** "Today", "Tomorrow", "In 5 days", "Sat, Mar 14". */
export function describeUpcoming(k: KeyDate, today: Date = new Date()): string {
  const days = daysUntilKeyDate(k, today)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  return format(nextOccurrence(k, today), 'EEE, MMM d')
}

export interface UpcomingKeyDate {
  keyDate: KeyDate
  date: Date
  days: number
}

/** Key dates coming round within `withinDays`, soonest first. */
export function upcomingKeyDates(
  items: KeyDate[],
  withinDays: number,
  today: Date = new Date(),
): UpcomingKeyDate[] {
  return items
    .map((keyDate) => ({
      keyDate,
      date: nextOccurrence(keyDate, today),
      days: daysUntilKeyDate(keyDate, today),
    }))
    .filter((u) => u.days <= withinDays)
    .sort((a, b) => a.days - b.days)
}

const MONTH_RE =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

/** "birthday is March 3rd", "bday on 3/14", "born March 3, 1999". */
export function parseBirthday(text: string): Pick<KeyDate, 'month' | 'day' | 'year'> | null {
  const named = text.match(
    new RegExp(
      `\\b(?:birthday|bday|b-day|born)(?:'s|\\s+is)?(?:\\s+(?:on|in))?\\s+${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`,
      'i',
    ),
  )
  if (named) {
    const month = monthNumber(named[1])
    const day = Number(named[2])
    if (month && day >= 1 && day <= daysInMonth(month)) {
      return { month, day, year: named[3] ? Number(named[3]) : undefined }
    }
  }
  const numeric = text.match(
    /\b(?:birthday|bday|b-day|born)(?:'s|\s+is)?(?:\s+on)?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/i,
  )
  if (numeric) {
    const month = Number(numeric[1])
    const day = Number(numeric[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month)) {
      return { month, day, year: numeric[3] ? Number(numeric[3]) : undefined }
    }
  }
  return null
}

function monthNumber(word: string): number | undefined {
  const i = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(word.toLowerCase().slice(0, 3)))
  return i >= 0 ? i + 1 : undefined
}
