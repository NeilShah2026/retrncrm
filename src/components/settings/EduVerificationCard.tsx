import * as React from 'react'
import { BadgeCheck, GraduationCap, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useAuth } from '@/auth/AuthProvider'
import { useEntitlement } from '@/hooks/useEntitlement'
import {
  BABSON_DOMAIN,
  confirmVerification,
  isBabsonEmail,
  removeVerification,
  startVerification,
} from '@/lib/eduVerification'

type Step = 'idle' | 'code'

/**
 * Babson verification, for accounts signed in with something other than a
 * school address. Signing in with @babson.edu needs none of this — the offer
 * is already on, and this card just says so.
 */
export function EduVerificationCard() {
  const { user } = useAuth()
  const { edu } = useEntitlement()

  const [step, setStep] = React.useState<Step>('idle')
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
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

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const verified = await confirmVerification(email, code)
      setStep('idle')
      setEmail('')
      setCode('')
      toast.success(`${verified} verified — Retrn is free for you.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    try {
      await removeVerification()
      toast.success('Babson verification removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that.')
    }
  }

  // --- Verified -------------------------------------------------------------
  if (edu.verified) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-success" />
            <h2 className="font-semibold">Babson student — free</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="break-all font-medium text-foreground">{edu.email}</span>{' '}
            is verified, so every paid feature is unlocked on this account at no
            charge.
          </p>
          {edu.via === 'account-email' ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Verified automatically because you sign in with your Babson email.
            </p>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 -ml-3 text-muted-foreground"
              onClick={() => setConfirmRemove(true)}
            >
              Remove this verification
            </Button>
          )}

          <ConfirmDialog
            open={confirmRemove}
            onOpenChange={setConfirmRemove}
            title="Remove Babson verification?"
            description="Your account keeps all its data, but it stops counting as a verified Babson student. You can verify the same address again later."
            confirmLabel="Remove"
            destructive
            onConfirm={handleRemove}
          />
        </CardContent>
      </Card>
    )
  }

  // --- Not verified ---------------------------------------------------------
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          <h2 className="font-semibold">Babson student?</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Verify an <span className="text-foreground">@{BABSON_DOMAIN}</span> address
          and Retrn is free — every paid feature, no card. You&apos;re signed in as{' '}
          <span className="break-all text-foreground">{user?.email}</span>, so we&apos;ll
          send a code to your school address to confirm it&apos;s yours.
        </p>

        {step === 'idle' ? (
          <form onSubmit={handleSend} className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${BABSON_DOMAIN}`}
              autoComplete="email"
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="gap-2">
              <Mail className="h-4 w-4" />
              {busy ? 'Sending…' : 'Send verification code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code we sent to{' '}
              <span className="break-all text-foreground">
                {email.trim().toLowerCase()}
              </span>
              .
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              required
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('idle')
                  setCode('')
                  setError(null)
                }}
              >
                Use a different address
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
