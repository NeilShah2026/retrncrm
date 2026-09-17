import * as React from 'react'
import { toast } from 'sonner'
import { useEntitlement } from '@/hooks/useEntitlement'
import {
  BABSON_DOMAIN,
  confirmVerification,
  isBabsonEmail,
  parseVerificationInput,
  removeVerification,
  startVerification,
} from '@/lib/eduVerification'

export type EduStep = 'idle' | 'code'

/**
 * Babson verification: email a school address, then confirm what came back.
 * Shared by the desktop card and the phone's sheet so both behave the same.
 *
 * "What came back" is deliberately loose: the email's contents are decided by
 * a Supabase template that also serves the login page's magic link, so it may
 * hold a code, a link, or both. Either is accepted — see
 * `parseVerificationInput`.
 */
export function useEduVerification() {
  const { edu } = useEntitlement()
  const [step, setStep] = React.useState<EduStep>('idle')
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
      toast.success(`Email sent to ${email.trim().toLowerCase()}`)
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
      setError('Enter the code from the email, or paste the whole link.')
      return false
    }
    setBusy(true)
    try {
      const verified = await confirmVerification(email, code)
      setStep('idle')
      setEmail('')
      setCode('')
      toast.success(`${verified} verified — Retrn is free for you.`)
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
