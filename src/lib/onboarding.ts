import type { User } from '@supabase/supabase-js'
import type { ContactFrequency, Tag } from '@/types'
import type { TagDraft } from '@/services/types'

/**
 * What onboarding asks, and what each answer actually changes.
 *
 * The rule this file exists to enforce: **no question is asked that does not
 * change something.** An onboarding survey whose answers go nowhere is worse
 * than no survey — it spends the one moment of attention a new account gives
 * you and returns a screen that says "All set!" over an app that is identical
 * to the one everybody else got. Every option below is wired to a tag that
 * gets created, a default that gets set, or copy that changes downstream, and
 * the "tailoring" step reports only work that really happened.
 */

export type OnboardingFocus = 'job' | 'network' | 'venture' | 'keep-close'
export type OnboardingStage = 'in-school' | 'graduating' | 'working' | 'other'
export type OnboardingPlace = 'career-fairs' | 'coffee-chats' | 'campus' | 'online'
/** A subset of ContactFrequency: the cadences worth defaulting to. */
export type OnboardingCadence = Extract<
  ContactFrequency,
  'monthly' | 'quarterly' | 'biannually' | 'none'
>

export interface OnboardingAnswers {
  focus?: OnboardingFocus
  stage?: OnboardingStage
  place?: OnboardingPlace
  cadence?: OnboardingCadence
}

/** The answers as they are stored on the account, plus the completion flag. */
export interface OnboardingPrefs extends OnboardingAnswers {
  onboarded?: boolean
  /** ISO timestamp of the last completed run, for support. */
  onboardedAt?: string
}

export interface OnboardingOption<T extends string> {
  value: T
  label: string
  /** The second line — what picking this actually means. */
  detail: string
}

export interface OnboardingQuestion<T extends string = string> {
  /** Which key of `OnboardingAnswers` this writes. */
  key: keyof OnboardingAnswers
  eyebrow: string
  prompt: string
  caption: string
  options: OnboardingOption<T>[]
}

export const FOCUS_QUESTION: OnboardingQuestion<OnboardingFocus> = {
  key: 'focus',
  eyebrow: 'One of four',
  prompt: 'What are you working toward?',
  caption: 'This sets up the tags you’ll actually use.',
  options: [
    {
      value: 'job',
      label: 'An internship or a job',
      detail: 'Recruiters, referrals, alumni',
    },
    {
      value: 'network',
      label: 'A network that outlasts school',
      detail: 'Mentors, peers, your industry',
    },
    {
      value: 'venture',
      label: 'Something I’m building',
      detail: 'Investors, founders, customers',
    },
    {
      value: 'keep-close',
      label: 'Staying close to who I know',
      detail: 'Former colleagues and mentors',
    },
  ],
}

export const STAGE_QUESTION: OnboardingQuestion<OnboardingStage> = {
  key: 'stage',
  eyebrow: 'Two of four',
  prompt: 'Where are you right now?',
  caption: 'Changes what Retrn puts in front of you first.',
  options: [
    { value: 'in-school', label: 'In school', detail: 'A year or more to go' },
    { value: 'graduating', label: 'Graduating soon', detail: 'Recruiting season is now' },
    { value: 'working', label: 'Working', detail: 'Building on what I’ve got' },
    { value: 'other', label: 'Something else', detail: 'Between things, or none of the above' },
  ],
}

export const PLACE_QUESTION: OnboardingQuestion<OnboardingPlace> = {
  key: 'place',
  eyebrow: 'Three of four',
  prompt: 'Where do you meet most people?',
  caption: 'Adds a tag for how you met them.',
  options: [
    { value: 'career-fairs', label: 'Career fairs, info sessions', detail: 'Lots of people, fast' },
    { value: 'coffee-chats', label: 'Coffee chats and intros', detail: 'One at a time, warm' },
    { value: 'campus', label: 'Class, clubs, campus', detail: 'The people around me' },
    { value: 'online', label: 'LinkedIn and cold outreach', detail: 'It started with a message' },
  ],
}

export const CADENCE_QUESTION: OnboardingQuestion<OnboardingCadence> = {
  key: 'cadence',
  eyebrow: 'Four of four',
  prompt: 'How often should Retrn nudge you?',
  caption: 'Becomes the default reconnect goal on everyone you add.',
  options: [
    { value: 'monthly', label: 'Every month', detail: 'For a small, active list' },
    { value: 'quarterly', label: 'Every three months', detail: 'What most people settle on' },
    { value: 'biannually', label: 'Twice a year', detail: 'Enough to not go cold' },
    { value: 'none', label: 'Don’t nudge me', detail: 'I’ll set reminders myself' },
  ],
}

export const QUESTIONS = [
  FOCUS_QUESTION,
  STAGE_QUESTION,
  PLACE_QUESTION,
  CADENCE_QUESTION,
] as const

// --- What the answers change -----------------------------------------------

/**
 * The tags each answer earns. Names are things you would genuinely put on a
 * person — not categories of app feature — because a tag nobody would ever
 * apply is clutter that has to be deleted before the list is useful.
 */
const FOCUS_TAGS: Record<OnboardingFocus, { name: string; color: string }[]> = {
  job: [
    { name: 'Recruiter', color: 'green' },
    { name: 'Referral', color: 'amber' },
    { name: 'Alumni', color: 'blue' },
  ],
  network: [
    { name: 'Mentor', color: 'teal' },
    { name: 'Peer', color: 'blue' },
    { name: 'In my industry', color: 'slate' },
  ],
  venture: [
    { name: 'Investor', color: 'green' },
    { name: 'Founder', color: 'blue' },
    { name: 'Early customer', color: 'amber' },
  ],
  'keep-close': [
    { name: 'Mentor', color: 'teal' },
    { name: 'Former colleague', color: 'blue' },
  ],
}

const PLACE_TAGS: Record<OnboardingPlace, { name: string; color: string }> = {
  'career-fairs': { name: 'Career fair', color: 'orange' },
  'coffee-chats': { name: 'Coffee chat', color: 'orange' },
  campus: { name: 'Campus', color: 'orange' },
  online: { name: 'LinkedIn', color: 'orange' },
}

/**
 * The tags these answers would add, minus any the account already has.
 * Matched case-insensitively on name, so running onboarding a second time
 * never creates "Mentor" twice.
 */
export function tagsToCreate(answers: OnboardingAnswers, existing: Tag[] = []): TagDraft[] {
  const drafts: { name: string; color: string }[] = []
  if (answers.focus) drafts.push(...FOCUS_TAGS[answers.focus])
  if (answers.place) drafts.push(PLACE_TAGS[answers.place])

  const taken = new Set(existing.map((t) => t.name.trim().toLowerCase()))
  const out: TagDraft[] = []
  for (const draft of drafts) {
    const key = draft.name.toLowerCase()
    if (taken.has(key)) continue
    taken.add(key)
    out.push(draft)
  }
  return out
}

const CADENCE_LABELS: Record<OnboardingCadence, string> = {
  monthly: 'every month',
  quarterly: 'every three months',
  biannually: 'twice a year',
  none: 'off',
}

export function cadenceLabel(cadence: OnboardingCadence | undefined): string {
  return cadence ? CADENCE_LABELS[cadence] : CADENCE_LABELS.quarterly
}

/**
 * The reconnect goal a newly added contact starts with.
 *
 * This is the answer to the cadence question doing its actual work: without
 * it that question would be a survey. Read by the contact form and the quick
 * capture sheet, so "every three months" means every person you add really
 * does arrive with a quarterly goal on them.
 */
export function defaultContactFrequency(user: User | null | undefined): ContactFrequency {
  const cadence = (user?.user_metadata as OnboardingPrefs | undefined)?.cadence
  return cadence ?? 'none'
}

/** The answers already on the account, for a re-run that starts where you left off. */
export function readOnboardingAnswers(user: User | null | undefined): OnboardingAnswers {
  const meta = (user?.user_metadata ?? {}) as OnboardingPrefs
  return {
    focus: meta.focus,
    stage: meta.stage,
    place: meta.place,
    cadence: meta.cadence,
  }
}

export function hasOnboarded(user: User | null | undefined): boolean {
  return Boolean((user?.user_metadata as OnboardingPrefs | undefined)?.onboarded)
}
