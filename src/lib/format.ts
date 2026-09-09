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

/**
 * Deterministic avatar tint from a name. Muted tints with dark text — a
 * colour per person so a list scans, but never a saturated disc.
 */
const AVATAR_COLORS = [
  'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100',
  'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
  'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
  'bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-100',
  'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100',
  'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100',
  'bg-slate-200 text-slate-900 dark:bg-slate-500/25 dark:text-slate-100',
  'bg-stone-200 text-stone-900 dark:bg-stone-500/25 dark:text-stone-100',
  'bg-pink-100 text-pink-900 dark:bg-pink-500/20 dark:text-pink-100',
]

/** A blank contact (no name yet) gets a neutral placeholder, not a colour. */
export const AVATAR_NEUTRAL = 'bg-bg-sunken text-muted-foreground'

export function avatarColor(seed: string): string {
  if (!seed || seed === 'contact') return AVATAR_NEUTRAL
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

/** "Mar 14" — for dense rows where the year is noise. */
export function formatDateShort(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return '—'
  return d.getFullYear() === new Date().getFullYear()
    ? format(d, 'MMM d')
    : format(d, 'MMM d, yyyy')
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

/** "3mo", "2w", "5d" — for a column that has to stay narrow. */
export function formatRelativeShort(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return '—'
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
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
