import type {
  ConnectionType,
  ContactFrequency,
  InteractionType,
  MeetSource,
  OpportunityOutcome,
  OpportunityStage,
  OpportunityType,
  TemplateCategory,
} from '@/types'

/** Tag color palette. Values are Tailwind-compatible class fragments so a tag
 *  can be rendered consistently anywhere. Each entry is theme-aware. */
export const TAG_COLORS: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  slate: {
    label: 'Slate',
    dot: 'bg-slate-500',
    badge:
      'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  },
  red: {
    label: 'Red',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-orange-500',
    badge:
      'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  },
  amber: {
    label: 'Amber',
    dot: 'bg-amber-500',
    badge:
      'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  },
  green: {
    label: 'Green',
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  teal: {
    label: 'Teal',
    dot: 'bg-teal-500',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  },
  blue: {
    label: 'Blue',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  },
  indigo: {
    label: 'Indigo',
    dot: 'bg-indigo-500',
    badge:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  },
  violet: {
    label: 'Violet',
    dot: 'bg-violet-500',
    badge:
      'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
  pink: {
    label: 'Pink',
    dot: 'bg-pink-500',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
  },
}

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS)

export function tagColor(color: string) {
  return TAG_COLORS[color] ?? TAG_COLORS.slate
}

/**
 * Reconnect cadence: a number of days between catch-ups, stored as "45d", or
 * "none". The dropdown offers the presets; "Custom…" takes any number.
 */
export const FREQUENCY_PRESET_DAYS = [30, 45, 60, 90] as const
export const FREQUENCY_KEYS: ContactFrequency[] = [
  'none',
  ...FREQUENCY_PRESET_DAYS.map((d) => `${d}d` as ContactFrequency),
]
/** The longest cadence "Custom…" accepts. */
export const MAX_FREQUENCY_DAYS = 730

/**
 * The cadences older versions stored by name. Each keeps its own interval
 * (quarterly was 91 days, now the 90-day preset), so nobody's reconnect
 * schedule moves when they upgrade.
 */
const LEGACY_FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  biannually: 182,
  annually: 365,
}

export function frequencyFromDays(days: number): ContactFrequency {
  const n = Math.round(days)
  if (!Number.isFinite(n) || n < 1) return 'none'
  return `${Math.min(n, MAX_FREQUENCY_DAYS)}d` as ContactFrequency
}

/** Days between catch-ups, or null for no goal. */
export function frequencyDays(f: ContactFrequency | string | null | undefined): number | null {
  if (!f || f === 'none') return null
  const m = /^(\d+)d$/.exec(f)
  if (m) return Number(m[1]) || null
  return LEGACY_FREQUENCY_DAYS[f] ?? null
}

/**
 * Anything that might describe a cadence — "45d", 45, "45", "monthly",
 * "every 45 days", "every 2 weeks" — as a stored value, or undefined when it
 * doesn't describe one. Used for stored rows, imports, AI replies and speech.
 */
export function parseFrequency(raw: unknown): ContactFrequency | undefined {
  if (typeof raw === 'number') return frequencyFromDays(raw)
  if (typeof raw !== 'string') return undefined
  const s = raw.trim().toLowerCase()
  if (!s) return undefined
  if (s === 'none' || s === 'no goal') return 'none'
  if (/^\d+d?$/.test(s)) return frequencyFromDays(parseInt(s, 10))
  if (s in LEGACY_FREQUENCY_DAYS) return frequencyFromDays(LEGACY_FREQUENCY_DAYS[s])
  const m = /(\d+)\s*(day|week|month)/.exec(s)
  if (m) {
    const unit = m[2] === 'week' ? 7 : m[2] === 'month' ? 30 : 1
    return frequencyFromDays(Number(m[1]) * unit)
  }
  return undefined
}

/** A stored value, normalised — legacy names become day counts. */
export function normalizeFrequency(raw: unknown): ContactFrequency {
  return parseFrequency(raw) ?? 'none'
}

/** "Every 45 days", or "No goal". */
export function frequencyLabel(f: ContactFrequency | string | null | undefined): string {
  const days = frequencyDays(f)
  return days === null ? 'No goal' : `Every ${days} ${days === 1 ? 'day' : 'days'}`
}

/** "45 days", or "—" — for tables. */
export function frequencyShort(f: ContactFrequency | string | null | undefined): string {
  const days = frequencyDays(f)
  return days === null ? '—' : `${days} ${days === 1 ? 'day' : 'days'}`
}

export function isPresetFrequency(f: ContactFrequency): boolean {
  return FREQUENCY_KEYS.includes(f)
}

/** Interaction types → label + emoji for the timeline. */
export const INTERACTION_TYPES: Record<
  InteractionType,
  { label: string; emoji: string }
> = {
  call: { label: 'Call', emoji: '📞' },
  email: { label: 'Email', emoji: '✉️' },
  coffee: { label: 'Coffee', emoji: '☕' },
  text: { label: 'Text', emoji: '💬' },
  event: { label: 'Event', emoji: '🎟️' },
  meeting: { label: 'Meeting', emoji: '🤝' },
  linkedin: { label: 'LinkedIn', emoji: '🔗' },
  other: { label: 'Other', emoji: '•' },
}

export const INTERACTION_TYPE_KEYS = Object.keys(
  INTERACTION_TYPES,
) as InteractionType[]

export const STRENGTH_LABELS: Record<number, string> = {
  1: 'Acquaintance',
  2: 'Loose tie',
  3: 'Known contact',
  4: 'Strong contact',
  5: 'Close',
}

/** Considered "reconnect worthy" if no contact in this many days, regardless
 *  of an explicit frequency goal. */
export const STALE_CONTACT_DAYS = 182

/** How a contact relates to you (student-centered). */
export const CONNECTION_TYPES: Record<
  ConnectionType,
  { label: string; emoji: string }
> = {
  recruiter: { label: 'Recruiter', emoji: '🧲' },
  professor: { label: 'Professor', emoji: '🎓' },
  alumni: { label: 'Alum', emoji: '🏛️' },
  classmate: { label: 'Classmate', emoji: '📚' },
  founder: { label: 'Founder', emoji: '🚀' },
  mentor: { label: 'Mentor', emoji: '🧭' },
  investor: { label: 'Investor', emoji: '💰' },
  peer: { label: 'Peer', emoji: '🤝' },
  other: { label: 'Other', emoji: '•' },
}

export const CONNECTION_TYPE_KEYS = Object.keys(
  CONNECTION_TYPES,
) as ConnectionType[]

/** Where/how you met — campus-life oriented sources. */
export const MEET_SOURCES: Record<
  MeetSource,
  { label: string; emoji: string }
> = {
  'career-fair': { label: 'Career fair', emoji: '🎪' },
  class: { label: 'Class', emoji: '🏫' },
  club: { label: 'Club / org', emoji: '🎭' },
  'networking-event': { label: 'Networking event', emoji: '🥂' },
  'guest-lecture': { label: 'Guest lecture', emoji: '🎤' },
  hackathon: { label: 'Hackathon', emoji: '💻' },
  'info-session': { label: 'Info session', emoji: '📊' },
  'coffee-chat': { label: 'Coffee chat', emoji: '☕' },
  referral: { label: 'Referral / intro', emoji: '🔗' },
  online: { label: 'Online', emoji: '🌐' },
  travel: { label: 'Travel', emoji: '✈️' },
  other: { label: 'Other', emoji: '📍' },
}

export const MEET_SOURCE_KEYS = Object.keys(MEET_SOURCES) as MeetSource[]

/** Recruiting-pipeline stages, in board order, with theme-aware colors. */
export const OPPORTUNITY_STAGES: Record<
  OpportunityStage,
  { label: string; dot: string; badge: string; column: string }
> = {
  researching: {
    label: 'Researching',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
    column: 'border-slate-300 dark:border-slate-600',
  },
  applied: {
    label: 'Applied',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    column: 'border-blue-400 dark:border-blue-500',
  },
  interviewing: {
    label: 'Interviewing',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    column: 'border-amber-400 dark:border-amber-500',
  },
  offer: {
    label: 'Offer',
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    column: 'border-emerald-400 dark:border-emerald-500',
  },
  closed: {
    label: 'Closed',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400',
    column: 'border-zinc-300 dark:border-zinc-600',
  },
}

export const OPPORTUNITY_STAGE_KEYS = Object.keys(
  OPPORTUNITY_STAGES,
) as OpportunityStage[]

export const OPPORTUNITY_TYPES: Record<OpportunityType, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
  'co-op': 'Co-op',
  research: 'Research',
  'part-time': 'Part-time',
  other: 'Other',
}

export const OPPORTUNITY_TYPE_KEYS = Object.keys(
  OPPORTUNITY_TYPES,
) as OpportunityType[]

export const OPPORTUNITY_OUTCOMES: Record<
  OpportunityOutcome,
  { label: string; variant: 'success' | 'destructive' | 'secondary' }
> = {
  accepted: { label: 'Accepted 🎉', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  withdrawn: { label: 'Withdrawn', variant: 'secondary' },
  ghosted: { label: 'Ghosted', variant: 'secondary' },
}

export const OPPORTUNITY_OUTCOME_KEYS = Object.keys(
  OPPORTUNITY_OUTCOMES,
) as OpportunityOutcome[]

export const TEMPLATE_CATEGORIES: Record<
  TemplateCategory,
  { label: string; emoji: string }
> = {
  'cold-intro': { label: 'Cold intro', emoji: '👋' },
  'thank-you': { label: 'Thank you', emoji: '🙏' },
  'coffee-chat': { label: 'Coffee chat', emoji: '☕' },
  'follow-up': { label: 'Follow-up', emoji: '🔁' },
  'referral-ask': { label: 'Referral ask', emoji: '🎯' },
  other: { label: 'Other', emoji: '✉️' },
}

export const TEMPLATE_CATEGORY_KEYS = Object.keys(
  TEMPLATE_CATEGORIES,
) as TemplateCategory[]

/** Public Chrome Web Store listing for the Retrn browser extension. */
export const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/retrn-%E2%80%94-log-emails-contac/hjdanpmlocgaihgmlldhjjbmlnjepnkk'
