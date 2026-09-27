import type { PlanId } from './plans'

/**
 * What each plan actually unlocks.
 *
 * The contact limit is enforced by the database (0007_billing.sql) because
 * data can be written from outside the app. Everything here is UI: the
 * feature exists in the bundle either way, so this is about what Retrn
 * offers, not about secrets. Anything that must not be spoofed belongs on
 * the server instead.
 */
export type Feature =
  /** One-sentence / spoken capture, and scanning a business card. */
  | 'capture'
  /** The recruiting pipeline: opportunities and their stages. */
  | 'pipeline'
  /** Follow-ups and key dates. */
  | 'reminders'
  /** CSV and JSON export of everything. */
  | 'export'
  /** Subscribing an outside calendar to Retrn's feed. */
  | 'calendarSync'
  /** Past FREE_COLD_TARGET_LIMIT open cold email targets. */
  | 'coldEmailUnlimited'
  /** The model writing a cold email draft, or reviewing one. */
  | 'coldEmailAI'

/** The cheapest plan that includes each feature. */
const REQUIRES: Record<Feature, 'paid' | 'standard'> = {
  capture: 'paid',
  pipeline: 'paid',
  reminders: 'paid',
  export: 'paid',
  calendarSync: 'standard',
  coldEmailUnlimited: 'paid',
  coldEmailAI: 'paid',
}

/** What to say when someone runs into the gate. */
export const FEATURE_COPY: Record<Feature, { title: string; description: string }> = {
  capture: {
    title: 'Capture is a paid feature',
    description:
      'Say or type one sentence — "met Dana from Fidelity at the career fair" — and Retrn fills in the contact. Scanning a business card works the same way.',
  },
  pipeline: {
    title: 'The pipeline is a paid feature',
    description:
      'Track every application from coffee chat to offer, with the people who can help attached to each one.',
  },
  reminders: {
    title: 'Reminders are a paid feature',
    description:
      'Set a follow-up for a date you choose, and keep birthdays and work anniversaries where you’ll see them coming.',
  },
  export: {
    title: 'Export is a paid feature',
    description:
      'Take everything with you: a JSON backup you can re-import, or a CSV that opens in any spreadsheet.',
  },
  coldEmailUnlimited: {
    title: 'The free plan tracks 10 cold emails at a time',
    description:
      'Make a contact of anyone who wrote back, or close the ones you’re done with, to free a slot — or upgrade to track everyone you’re writing to.',
  },
  coldEmailAI: {
    title: 'Drafts and reviews are a paid feature',
    description:
      'Get a first draft built from who they are and why you’re writing, or have yours read back for what will get it ignored: too long, no clear ask, a subject line nobody opens.',
  },
  calendarSync: {
    title: 'Calendar sync is on Standard',
    description:
      'Subscribe Apple Calendar, Google Calendar or Outlook to your Retrn meetings, and have past meetings log themselves.',
  },
}

/** 'standard' when only the top plan includes it; 'paid' for any subscription. */
export function requiredPlan(feature: Feature): 'paid' | 'standard' {
  return REQUIRES[feature]
}

/** Does `plan` include `feature`? */
export function planAllows(plan: PlanId | 'babson', feature: Feature): boolean {
  const needs = REQUIRES[feature]
  if (plan === 'free') return false
  // The Babson offer is every paid feature, so it clears both bars.
  if (plan === 'babson') return true
  return needs === 'paid' ? true : plan === 'standard'
}
