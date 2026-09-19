import * as React from 'react'
import { BadgeCheck, GraduationCap, Loader2, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useAuth } from '@/auth/AuthProvider'
import { BABSON_DOMAIN } from '@/lib/eduVerification'
import { useEduVerification } from './useEduVerification'

/**
 * Babson verification, for accounts signed in with something other than a
 * school address. Signing in with @babson.edu needs none of this — the offer
 * is already on, and this card just says so.
 */
export function EduVerificationCard() {
  const { user } = useAuth()
  const {
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
  } = useEduVerification()
  const [confirmRemove, setConfirmRemove] = React.useState(false)

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
            is verified, so every paid feature is on for this account at no
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
            onConfirm={remove}
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
          email your school address to confirm it&apos;s yours.
        </p>

        {step === 'idle' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
            className="space-y-3"
          >
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
              {busy ? 'Sending…' : 'Email me a link'}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void confirm()
            }}
            className="space-y-3"
          >
            <div className="flex items-start gap-2.5 rounded-md bg-bg-sunken px-3 py-2.5 text-sm">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              <p className="text-text-secondary">
                We emailed a link to{' '}
                <span className="break-all text-foreground">{email.trim().toLowerCase()}</span>.
                Open it — on this computer or your phone — and tap Verify. This page updates on
                its own.
              </p>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Link won&apos;t open? Copy it from the email and paste it here instead.
            </p>
            {/* No `maxLength` and no numeric input mode: either would quietly
                mangle a pasted verification link. */}
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the link from the email"
              autoComplete="off"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline" disabled={busy || !code.trim()}>
                {busy ? 'Verifying…' : 'Verify pasted link'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={useAnotherAddress}
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
