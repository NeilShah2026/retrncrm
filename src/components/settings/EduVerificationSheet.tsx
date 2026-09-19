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
 * School-email verification on a phone: the address, then the link, as two
 * steps of one sheet. A verified .edu is what Student pricing is sold
 * against; a verified @babson.edu makes everything free instead. Accounts
 * already signed in with a school address need none of it — the sheet just
 * says so.
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
            title={edu.student ? 'School Email' : 'Verify School Email'}
          />
        </DialogHeader>

        <div className="space-y-6 px-4 pb-6 pt-1">
          {edu.student ? (
            <>
              <p className="text-ios-subhead px-1 text-muted-foreground">
                <span className="text-foreground">{edu.email}</span>{' '}
                {edu.verified
                  ? 'is verified, so every paid feature is on for this account at no charge.'
                  : 'is verified, so you can subscribe at Student pricing.'}
              </p>
              {edu.via === 'account-email' ? (
                <p className="text-ios-footnote px-1 text-muted-foreground">
                  Verified automatically because you sign in with your school email.
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
                Verify a school email (one ending in{' '}
                <span className="text-foreground">.edu</span>) to subscribe at Student pricing —
                and an <span className="text-foreground">@{BABSON_DOMAIN}</span> address makes
                every paid feature free instead. You're signed in as{' '}
                <span className="break-all text-foreground">{user?.email}</span>, so we'll email
                your school address to confirm it's yours.
              </p>
              <InsetGroup footer={error}>
                <InsetInputRow
                  label="School email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@school.edu"
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
                We emailed a link to{' '}
                <span className="break-all text-foreground">{email.trim().toLowerCase()}</span>.
                Open it and tap Verify — this screen updates on its own.
              </p>
              <InsetGroup
                footer={error ?? 'Link won’t open? Copy it from the email and paste it here.'}
              >
                <InsetInputRow
                  label="Link"
                  value={code}
                  onChange={setCode}
                  placeholder="Paste the link"
                  autoComplete="off"
                  enterKeyHint="done"
                  onEnter={() => void confirm()}
                  last
                />
              </InsetGroup>
            </>
          )}
        </div>

        {!edu.student && (
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
              {step === 'idle' ? 'Email Me a Link' : 'Verify Pasted Link'}
            </Button>
          </DialogFooter>
        )}

        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title="Remove this verification?"
          description="Your account keeps all its data, but it stops counting as a verified student, so Student pricing and the Babson offer stop applying. You can verify the same address again later."
          confirmLabel="Remove"
          destructive
          onConfirm={remove}
        />
      </DialogContent>
    </Dialog>
  )
}
