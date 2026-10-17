/**
 * Cleaning up what people actually type into spreadsheets: dates in any of a
 * dozen formats, LinkedIn as a URL or a handle, "Class of '27", a whole name
 * in one cell. Each function returns null when it can't make sense of the
 * value, so the review screen can flag it rather than guess.
 */

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]

function monthFromName(word: string): number | null {
  const i = MONTHS.indexOf(word.toLowerCase().slice(0, 3))
  return i === -1 ? null : i + 1
}

const pad = (n: number) => String(n).padStart(2, '0')

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function fullYear(y: number): number {
  if (y >= 100) return y
  // Two-digit years: '27 is 2027, '98 is 1998.
  const now = new Date().getFullYear() % 100
  return y <= now + 10 ? 2000 + y : 1900 + y
}

interface DateParts {
  year?: number
  month: number
  day: number
}

/** Month and day, with a year when the value has one. */
function dateParts(raw: string): DateParts | null {
  const s = raw.trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!s) return null
  let m: RegExpMatchArray | null

  // 2026-09-18, 2026/9/18, 2026-09-18T00:00:00
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    return { year: +m[1], month: +m[2], day: +m[3] }
  }
  // 9/18/2026, 9-18-26 (US order); 18.09.2026 (dots: day first, as in Europe)
  if ((m = s.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})$/))) {
    const [a, sep, b, y] = [+m[1], m[2], +m[3], fullYear(+m[4])]
    if (sep === '.' || a > 12) return { year: y, month: b, day: a }
    return { year: y, month: a, day: b }
  }
  // 9/18 (birthday without a year)
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/))) {
    return { month: +m[1], day: +m[2] }
  }
  // September 18 2026 / Sep 18 / September 18
  if ((m = s.match(/^([a-z]+)\.? (\d{1,2})(?: (\d{2,4}))?$/i))) {
    const month = monthFromName(m[1])
    if (month) return { month, day: +m[2], year: m[3] ? fullYear(+m[3]) : undefined }
  }
  // 18 September 2026 / 18 Sep
  if ((m = s.match(/^(\d{1,2}) ([a-z]+)\.?(?: (\d{2,4}))?$/i))) {
    const month = monthFromName(m[2])
    if (month) return { month, day: +m[1], year: m[3] ? fullYear(+m[3]) : undefined }
  }
  // September 2026 → the 1st (good enough for "when we met")
  if ((m = s.match(/^([a-z]+)\.? (\d{4})$/i))) {
    const month = monthFromName(m[1])
    if (month) return { month, day: 1, year: +m[2] }
  }
  // An Excel serial date that arrived as a number (CSV exports do this).
  if ((m = s.match(/^(\d{5})(\.\d+)?$/))) {
    const serial = +m[1]
    if (serial > 20000 && serial < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
    }
  }
  return null
}

/** A full date as yyyy-mm-dd, or null. */
export function parseDate(raw: string): string | null {
  const p = dateParts(raw)
  if (!p || p.year === undefined || !validDate(p.year, p.month, p.day)) return null
  if (p.year < 1900 || p.year > 2100) return null
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** A birthday: month and day, year optional. */
export function parseBirthday(raw: string): DateParts | null {
  const p = dateParts(raw)
  if (!p) return null
  if (!validDate(p.year ?? 2000, p.month, p.day)) return null
  return p
}

/** How a birthday reads back in the review table: "Mar 3" or "Mar 3, 1999". */
export function formatBirthday(p: DateParts): string {
  const month = MONTHS[p.month - 1]
  const label = `${month[0].toUpperCase()}${month.slice(1)} ${p.day}`
  return p.year ? `${label}, ${p.year}` : label
}

/** "Maya Patel" → Maya / Patel; "Patel, Maya" → Maya / Patel. */
export function splitName(raw: string): { firstName: string; lastName: string } {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (s.includes(',')) {
    const [last, first] = s.split(',', 2).map((p) => p.trim())
    if (first) return { firstName: first, lastName: last }
  }
  const [first, ...rest] = s.split(' ')
  return { firstName: first ?? '', lastName: rest.join(' ') }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function cleanEmail(raw: string): string {
  // "a@x.com; b@y.com" → the first one; "mailto:" links from some exports.
  return raw.replace(/^mailto:/i, '').split(/[;,\s]+/)[0]?.trim().toLowerCase() ?? ''
}

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

/** linkedin.com/in/x, in/x, @x or a bare handle → https://www.linkedin.com/in/x */
export function cleanLinkedin(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const fromUrl = s.match(/linkedin\.com\/(in|pub|company)\/([^/?#\s]+)/i)
  if (fromUrl) return `https://www.linkedin.com/${fromUrl[1].toLowerCase()}/${fromUrl[2]}`
  const handle = s.replace(/^@/, '').replace(/^in\//i, '')
  if (/^[a-z0-9-]{3,100}$/i.test(handle)) return `https://www.linkedin.com/in/${handle}`
  return s
}

export function cleanTwitter(raw: string): string {
  const s = raw.trim()
  const fromUrl = s.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})/i)
  return (fromUrl?.[1] ?? s.replace(/^@/, '')).trim()
}

export function cleanWebsite(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

/** "2027", "'27", "Class of 2027", "2027.0" → "2027". */
export function cleanGradYear(raw: string): string {
  const s = raw.trim()
  const four = s.match(/\b(19|20)\d{2}\b/)
  if (four) return four[0]
  const two = s.match(/^'?(\d{2})$/)
  if (two) return String(fullYear(+two[1]))
  return s
}

/** "Alumni, Finance; Boston" → ["Alumni", "Finance", "Boston"] */
export function splitTags(raw: string): string[] {
  return raw
    .split(/[,;|\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
}
