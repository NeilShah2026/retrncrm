import type { User } from '@supabase/supabase-js'
import type { ContactFrequency } from '@/types'

/**
 * What onboarding stores on the account.
 *
 * Onboarding asks for one thing — a name — and everything else is shown, not
 * asked. The name goes to `full_name`, the same key Settings, the greeting
 * and the share card already read, so there is one name on the account and
 * it is whatever the person typed here.
 */

/** A subset of ContactFrequency: the cadences an earlier onboarding let people pick. */
type OnboardingCadence = Extract<ContactFrequency, 'monthly' | 'quarterly' | 'biannually' | 'none'>

/** The onboarding keys as they are stored in `user_metadata`. */
export interface OnboardingPrefs {
  full_name?: string
  onboarded?: boolean
  /** ISO timestamp of the last completed run, for support. */
  onboardedAt?: string
  /**
   * Written by the old onboarding quiz, which no longer exists. Still read, so
   * accounts that answered it keep the default they chose.
   */
  cadence?: OnboardingCadence
}

/**
 * The name to prefill the name field with. Google puts `full_name` (and
 * `name`) on the account at sign-in; Apple only does on the very first
 * authorization, and email sign-up never does — so this is often empty.
 */
export function initialName(user: User | null | undefined): string {
  const meta = user?.user_metadata ?? {}
  return ((meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? '').trim()
}

/**
 * Whether onboarding may insist on a name.
 *
 * Not for Sign in with Apple: Apple offers to share the name as part of its
 * own sheet, and App Review rejects apps that then require it again. Those
 * accounts are asked, prefilled where Apple sent a name, but may skip.
 */
export function nameRequired(user: User | null | undefined): boolean {
  const meta = user?.app_metadata ?? {}
  const providers = (meta.providers as string[] | undefined) ?? [meta.provider as string]
  return !providers.includes('apple')
}

/**
 * The reconnect goal a newly added contact starts with. Read by the contact
 * form and the quick capture sheet.
 */
export function defaultContactFrequency(user: User | null | undefined): ContactFrequency {
  const cadence = (user?.user_metadata as OnboardingPrefs | undefined)?.cadence
  return cadence ?? 'none'
}

export function hasOnboarded(user: User | null | undefined): boolean {
  return Boolean((user?.user_metadata as OnboardingPrefs | undefined)?.onboarded)
}
