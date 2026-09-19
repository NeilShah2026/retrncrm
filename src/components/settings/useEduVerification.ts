import * as React from 'react'
import { toast } from 'sonner'
import { useEntitlement } from '@/hooks/useEntitlement'
import { supabase } from '@/lib/supabase'
import {
  BABSON_DOMAIN,
  confirmVerification,
  isBabsonEmail,
  parseVerificationInput,
  removeVerification,
  startVerification,
} from '@/lib/eduVerification'

export type EduStep = 'idle' | 'code'

/** How often to look for the link having been opened elsewhere. */
const POLL_MS = 5_000
/** Stop looking after this long; focusing the window still checks. */
const POLL_FOR_MS = 15 * 60_000

/**
 * Babson verification: email a school address a magic link, then wait for it
 * to be opened. Shared by the desktop card and the phone's sheet so both
 * behave the same.
 *
 * Opening the link finishes verification server-side (see /verify-edu), often
 * on another device — so while waiting, this re-mints the session now and then
 * and whenever the window regains focus, and the verified flag shows up in the
 * JWT on its own. Pasting the link (or a code, if the email template has one)
 * is kept as a fallback — see `parseVerificationInput`.
 */
export function useEduVerification() {
  const { edu } = useEntitlement()
  const [step, setStep] = React.useState<EduStep>('idle')
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Done means "a school email is now proven" — which for a non-Babson
  // address unlocks Student pricing rather than free access.
  const waiting = step === 'code' && !edu.student
  React.useEffect(() => {
    if (!waiting) return
    const check = () => void supabase.auth.refreshSession()
    const until = Date.now() + POLL_FOR_MS
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() < until) check()
    }, POLL_MS)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [waiting])

  // The link was opened (here or elsewhere) and the session caught up.
  const wasWaiting = React.useRef(false)
  React.useEffect(() => {
    if (wasWaiting.current && edu.student) {
      toast.success(
        edu.verified
          ? `${edu.email ?? 'Your school email'} verified — Retrn is free for you.`
          : `${edu.email ?? 'Your school email'} verified — Student pricing is unlocked.`,
        { id: 'edu-verified' },
      )
      setStep('idle')
      setEmail('')
      setCode('')
    }
    wasWaiting.current = waiting
  }, [waiting, edu.student, edu.verified, edu.email])

  async function send(): Promise<void> {
    setError(null)
    if (!isBabsonEmail(email)) {
      setError(`That doesn't look like an @${BABSON_DOMAIN} address.`)
      return
    }
    setBusy(true)
    try {
      await startVerification(email)
      setStep('code')
      toast.success(`Link sent to ${email.trim().toLowerCase()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that email.')
    } finally {
      setBusy(false)
    }
  }

  /** True once the address is verified. */
  async function confirm(): Promise<boolean> {
    setError(null)
    // Say what is wrong with the entry before spending a round trip on it.
    if (!parseVerificationInput(code)) {
      setError('Paste the whole link from the email.')
      return false
    }
    setBusy(true)
    try {
      const verified = await confirmVerification(email, code)
      setStep('idle')
      setEmail('')
      setCode('')
      toast.success(`${verified} verified.`, { id: 'edu-verified' })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work — try a fresh email.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    try {
      await removeVerification()
      toast.success('Babson verification removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that.')
    }
  }

  function useAnotherAddress() {
    setStep('idle')
    setCode('')
    setError(null)
  }

  return {
    edu,
    step,
    email,
    setEmail,
    code,
    setCode,
    busy,
    error,
    send,
    confirm,
    remove,
    useAnotherAddress,
  }
}
