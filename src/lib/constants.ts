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

/** Contact frequency presets → human labels + concrete day intervals. */
export const FREQUENCY_OPTIONS: Record<
  ContactFrequency,
  { label: string; short: string; days: number | null }
> = {
  none: { label: 'No goal', short: '—', days: null },
  weekly: { label: 'Every week', short: 'Weekly', days: 7 },
  monthly: { label: 'Every month', short: 'Monthly', days: 30 },
  quarterly: { label: 'Every 3 months', short: 'Quarterly', days: 91 },
  biannually: { label: 'Every 6 months', short: '6 months', days: 182 },
  annually: { label: 'Every year', short: 'Yearly', days: 365 },
}

export const FREQUENCY_KEYS = Object.keys(FREQUENCY_OPTIONS) as ContactFrequency[]

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
