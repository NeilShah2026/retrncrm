import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Permission to send someone's data to the AI provider.
 *
 * App Review Guideline 5.1.2(i): an app must say where personal data goes when
 * it goes to a third-party AI, and get explicit permission *before* it does.
 * Every AI feature here sends details about the people in your network to
 * Anthropic, so nothing reaches `/api/ai` until this account has said yes.
 *
 * The answer lives in `user_metadata.ai_consent`, so it follows the account
 * across devices and is turned off from the same place on all of them
 * (Settings → Privacy → AI features).
 */

export function hasAiConsent(user: User | null | undefined): boolean {
  return user?.user_metadata?.ai_consent === true
}

export async function setAiConsent(granted: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { ai_consent: granted, ai_consent_at: new Date().toISOString() },
  })
  return { error: error?.message ?? null }
}

/**
 * The on-screen prompt, registered by `AiConsentPrompt` once it mounts.
 * Resolves true when the person allows AI features.
 */
type Prompt = () => Promise<boolean>
let prompt: Prompt | null = null

export function registerAiConsentPrompt(next: Prompt | null): void {
  prompt = next
}

/** Only one prompt at a time, however many features ask at once. */
let pending: Promise<boolean> | null = null

/**
 * Ask, if we can. Returns false when there's no prompt mounted (the extension,
 * a test) — never true by default.
 */
export function requestAiConsent(): Promise<boolean> {
  if (!prompt) return Promise.resolve(false)
  if (!pending) {
    pending = prompt().finally(() => {
      pending = null
    })
  }
  return pending
}
