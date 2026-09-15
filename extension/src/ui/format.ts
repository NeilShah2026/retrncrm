import type { Contact } from '../db'

/** Tailwind's palette values for the web app's avatar tints (src/lib/format.ts). */
const AVATAR_TINTS = [
  'rose',
  'orange',
  'amber',
  'emerald',
  'teal',
  'sky',
  'blue',
  'slate',
  'stone',
  'pink',
] as const
export type AvatarTint = (typeof AVATAR_TINTS)[number]

/** The same deterministic tint the web app gives this name. */
export function avatarTint(seed: string): AvatarTint | 'neutral' {
  if (!seed) return 'neutral'
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]
}

export function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export const TAG_DOTS: Record<string, string> = {
  slate: '#64748b',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#10b981',
  teal: '#14b8a6',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  pink: '#ec4899',
}

/** Today as yyyy-mm-dd in local time. */
export function today(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function daysSince(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const then = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((midnight - then) / 86_400_000)
}

/** "today", "3 days ago", "5 weeks ago" — how long it's been. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const days = daysSince(iso)
  if (days < 0) return shortDate(iso)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  const years = Math.round(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

/** "Last in touch 3 weeks ago", or that nothing has been logged. */
export function lastTouch(contact: Pick<Contact, 'last_contact_date'>): string {
  return contact.last_contact_date
    ? `Last in touch ${relative(contact.last_contact_date)}`
    : 'Nothing logged yet'
}

/** "Sep 3" this year, "Sep 3, 2025" otherwise. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}

const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  biannually: 182,
  annually: 365,
}

/** Days past their catch-up goal, if they have one and are past it. */
export function overdueBy(contact: Contact): number | null {
  const goal = CADENCE_DAYS[contact.contact_frequency_goal ?? '']
  if (!goal || !contact.last_contact_date) return null
  const over = daysSince(contact.last_contact_date) - goal
  return over > 0 ? over : null
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'hey.com',
  'fastmail.com',
])

/** "priya@klaviyo.com" → "Klaviyo". Nothing for personal mailboxes. */
export function companyFromEmail(email: string | undefined): string {
  const domain = email?.split('@')[1]?.toLowerCase()
  if (!domain || PERSONAL_DOMAINS.has(domain)) return ''
  const labels = domain.split('.')
  // mail.babson.edu → babson; stripe.co.uk → stripe
  const tld = labels.length > 2 && labels.at(-2)!.length <= 3 ? 3 : 2
  const name = labels.at(-tld) ?? labels[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** "Software Engineer at Stripe" → title and company, when it reads that way. */
export function splitHeadline(headline: string | undefined): { title: string; company: string } {
  const h = (headline ?? '').split(/\s[|•·]\s/)[0].trim()
  const m = h.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i)
  return m ? { title: m[1].trim(), company: m[2].trim() } : { title: h, company: '' }
}

/** "Sarah Chen" from "sarah.chen@x.com" when the page only had an address. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0]
  return local
    .split(/[._-]+/)
    .filter((p) => p && !/^\d+$/.test(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}
