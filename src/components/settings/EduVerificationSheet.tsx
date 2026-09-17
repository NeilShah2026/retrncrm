import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  SheetBar,
  SheetBarButton,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { InsetGroup, InsetInputRow, InsetRow } from '@/components/ui/inset-list'
import { useAuth } from '@/auth/AuthProvider'
import { BABSON_DOMAIN } from '@/lib/eduVerification'
import { useEduVerification } from './useEduVerification'

/**
 * Babson verification on a phone: the school address, then the code, as two
 * steps of one sheet. Accounts already signed in with a school address are
 * verified without any of this — the sheet just says so.
 */
export function EduVerificationSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
        <DialogHeader>
          <SheetBar
            leading={
              step === 'code' ? (
                <SheetBarButton onClick={useAnotherAddress}>Back</SheetBarButton>
              ) : (
                <SheetBarButton close>Done</SheetBarButton>
              )
            }
            title={edu.verified ? 'Babson Student' : 'Verify School Email'}
          />
        </DialogHeader>

        <div className="space-y-6 px-4 pb-6 pt-1">
          {edu.verified ? (
            <>
              <p className="text-ios-subhead px-1 text-muted-foreground">
                <span className="text-foreground">{edu.email}</span> is verified, so every paid
                feature is on for this account at no charge.
              </p>
              {edu.via === 'account-email' ? (
                <p className="text-ios-footnote px-1 text-muted-foreground">
                  Verified automatically because you sign in with your Babson email.
                </p>
              ) : (
                <InsetGroup>
                  <InsetRow
                    title="Remove Verification"
                    destructive
                    centered
                    last
                    onClick={() => setConfirmRemove(true)}
                  />
                </InsetGroup>
              )}
            </>
          ) : step === 'idle' ? (
            <>
              <p className="text-ios-subhead px-1 text-muted-foreground">
                Verify an <span className="text-foreground">@{BABSON_DOMAIN}</span> address and
                Retrn is free — every paid feature, no card. You're signed in as{' '}
                <span className="break-all text-foreground">{user?.email}</span>, so we'll email
                your school address to confirm it's yours.
              </p>
              <InsetGroup footer={error}>
                <InsetInputRow
                  label="School email"
                  value={email}
                  onChange={setEmail}
                  placeholder={`you@${BABSON_DOMAIN}`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="send"
                  onEnter={() => void send()}
                  last
                />
              </InsetGroup>
            </>
          ) : (
            <>
              <p className="text-ios-subhead px-1 text-muted-foreground">
                Check{' '}
                <span className="break-all text-foreground">{email.trim().toLowerCase()}</span>.
                Enter the code from that email — or paste the whole link, if that's what it
                contains.
              </p>
              <InsetGroup
                footer={
                  error ?? (
                    // Tapping the link signs this device in *as the school
                    // account*, which is not what they came here to do.
                    'Paste the link rather than tapping it — tapping signs you in as your school account instead of verifying this one.'
                  )
                }
              >
                <InsetInputRow
                  label="Code"
                  value={code}
                  onChange={setCode}
                  placeholder="123456 or paste the link"
                  autoComplete="one-time-code"
                  enterKeyHint="done"
                  onEnter={() => void confirm()}
                  last
                />
              </InsetGroup>
            </>
          )}
        </div>

        {!edu.verified && (
          <DialogFooter className="px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3">
            <Button
              className="text-ios-headline"
              loading={busy}
              disabled={busy || (step === 'idle' ? !email.trim() : !code.trim())}
              onClick={() => {
                if (step === 'idle') void send()
                else void confirm()
              }}
            >
              {step === 'idle' ? 'Send Email' : 'Verify'}
            </Button>
          </DialogFooter>
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
      </DialogContent>
    </Dialog>
  )
}
