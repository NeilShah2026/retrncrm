import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { initialName, nameRequired } from '@/lib/onboarding'
import { ROUTES } from '@/lib/routes'
import { track } from '@/lib/analytics'
import { START_TOUR_STATE } from '@/components/tour/TourProvider'

/**
 * What the phone's and the laptop's welcome screens share: the name, and
 * what happens when it's in.
 *
 * Onboarding is one question now. Everything else — what Retrn does, where
 * things are — is shown inside the app by the tooltip tour
 * (components/tour), which the laptop starts as soon as this finishes.
 */

/**
 * The name is saved the moment it's submitted, and again by `finish` — so a
 * save that fails on a bad connection gets a second chance instead of leaving
 * the account nameless.
 */
export function useOnboardingFlow() {
  const navigate = useNavigate()
  const { user, updateName, saveOnboarding } = useAuth()

  const [name, setName] = React.useState(() => initialName(user))
  const [saving, setSaving] = React.useState(false)
  const nameRef = React.useRef(name)
  nameRef.current = name

  /** Leaving without a name (Sign in with Apple only) still counts as onboarded. */
  const finish = React.useCallback(
    (completed: boolean) => {
      track(completed ? 'onboarding_completed' : 'onboarding_skipped', { pane: 'name' })
      const fullName = nameRef.current.trim()
      void saveOnboarding({
        ...(fullName && { full_name: fullName }),
        onboarded: true,
        onboardedAt: new Date().toISOString(),
      })
      // `replace`, so Back from the app doesn't land on the welcome screen.
      // The state starts the tour on the dashboard (laptop only).
      navigate(ROUTES.dashboard, { replace: true, state: START_TOUR_STATE })
    },
    [navigate, saveOnboarding],
  )

  const mustName = nameRequired(user)
  const ready = (!mustName || name.trim().length > 0) && !saving

  const submit = React.useCallback(async () => {
    const trimmed = nameRef.current.trim()
    if (trimmed) {
      setSaving(true)
      const { error } = await updateName(trimmed)
      setSaving(false)
      // Not a reason to hold anyone here: `finish` writes it again.
      if (error) console.warn('[onboarding] name save failed; retrying at finish', error)
    }
    finish(true)
  }, [finish, updateName])

  return { name, setName, mustName, ready, saving, submit, skip: () => finish(false) }
}
