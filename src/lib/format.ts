import { format, formatDistanceToNowStrict, parseISO, isValid } from 'date-fns'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Contact } from '@/types'

export function fullName(c: Pick<Contact, 'firstName' | 'lastName'>): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
}

export function initials(c: Pick<Contact, 'firstName' | 'lastName'>): string {
  const a = c.firstName?.[0] ?? ''
  const b = c.lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

/** Deterministic avatar color from a name, so an initials avatar is stable. */
const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
]

export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function toDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? d : null
}

/** "Mar 14, 2024" */
export function formatDate(iso?: string | null): string {
  const d = toDate(iso)
  return d ? format(d, 'MMM d, yyyy') : '—'
}

/** "Mar 2024" */
export function formatMonthYear(iso?: string | null): string {
  const d = toDate(iso)
  return d ? format(d, 'MMM yyyy') : '—'
}

/** "3 months ago" */
export function formatRelative(iso?: string | null): string {
  const d = toDate(iso)
  return d ? `${formatDistanceToNowStrict(d)} ago` : 'Never'
}

/** Today as yyyy-mm-dd (local). */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Whole days between an ISO date and now (positive = in the past). */
export function daysSince(iso?: string | null): number | null {
  const d = toDate(iso)
  if (!d) return null
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

/** Render markdown notes to sanitized HTML. */
export function renderMarkdown(md?: string): string {
  if (!md?.trim()) return ''
  const raw = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] })
}
