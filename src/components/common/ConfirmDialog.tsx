import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /**
   * For the irreversible: the person has to type this word before the
   * button enables. Use for "clear everything", not for deleting one row.
   */
  confirmWord?: string
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  confirmWord,
  onConfirm,
}: Props) {
  const [typed, setTyped] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const isMobile = useIsMobile()

  React.useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const gated = Boolean(confirmWord) && typed.trim().toLowerCase() !== confirmWord?.toLowerCase()

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* On a phone this is an action sheet: what's about to happen, centred,
          over the button that does it. No close affordance — Cancel is right
          there, as it is in a UIAlertController. */}
      <DialogContent hideClose={isMobile} className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {confirmWord && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-word">
              Type <span className="font-mono text-foreground">{confirmWord}</span> to continue
            </Label>
            <Input
              id="confirm-word"
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !gated) void confirm()
              }}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void confirm()}
            disabled={gated}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
