import * as React from 'react'
import { toast } from 'sonner'
import { useEntitlement } from '@/hooks/useEntitlement'
import {
  BABSON_DOMAIN,
  confirmVerification,
  isBabsonEmail,
  removeVerification,
  startVerification,
} from '@/lib/eduVerification'

export type EduStep = 'idle' | 'code'

/**
 * Babson verification: send a code to a school address, then confirm it.
 * Shared by the desktop card and the phone's sheet so both behave the same.
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
      toast.success(`Code sent to ${email.trim().toLowerCase()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that code.')
    } finally {
      setBusy(false)
    }
  }

  /** True once the address is verified. */
  async function confirm(): Promise<boolean> {
    setError(null)
    setBusy(true)
    try {
      const verified = await confirmVerification(email, code)
      setStep('idle')
      setEmail('')
      setCode('')
      toast.success(`${verified} verified — Retrn is free for you.`)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work.')
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
