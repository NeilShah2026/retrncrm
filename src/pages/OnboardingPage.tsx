import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

/**
 * `/app/welcome` — onboarding as a screen of its own.
 *
 * Deliberately routed *outside* `AppLayout`: onboarding owns the whole
 * display, with no tab bar or sidebar under it, the way a first-run flow does
 * on iOS. Being a route rather than a modal also means it can be linked to
 * (Settings → Run Through Onboarding) and that leaving it is an ordinary
 * navigation instead of a dialog that has to be dismissed.
 */
export function OnboardingPage() {
  return <OnboardingFlow />
}
