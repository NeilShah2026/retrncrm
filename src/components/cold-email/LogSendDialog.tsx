import * as React from 'react'
import { toast } from 'sonner'
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
import { FOLLOW_UP_GAPS, nextFollowUpAfter, shortDate, targetName, todayIso } from '@/lib/coldEmail'
import { createId } from '@/lib/utils'
import { logSend } from './actions'
import type { ColdTarget } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ColdTarget
}

/**
 * "I sent it." Logged by hand when the email went out from somewhere the
 * extension wasn't watching — the date matters, since follow-ups count from it.
 */
export function LogSendDialog({ open, onOpenChange, target }: Props) {
  const isFirst = target.sends.length === 0
  const defaultSubject =
    target.draftSubject?.trim() ||
    (target.sends[0]?.subject ? `Re: ${target.sends[0].subject.replace(/^re:\s*/i, '')}` : '')

  const [date, setDate] = React.useState(todayIso())
  const [subject, setSubject] = React.useState(defaultSubject)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setDate(todayIso())
    setSubject(defaultSubject)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per open
  }, [open])

  // What the schedule will do once this is logged, said before it happens.
  const preview = React.useMemo(() => {
    if (target.status === 'replied' || target.status === 'converted') return null
    const next = nextFollowUpAfter([
      ...target.sends,
      { id: createId(), date: date || todayIso(), createdAt: new Date().toISOString() },
    ])
    return next
      ? `Retrn will remind you to follow up on ${shortDate(next)}.`
      : `That’s follow-up ${FOLLOW_UP_GAPS.length} of ${FOLLOW_UP_GAPS.length} — no more reminders after this.`
  }, [target.sends, target.status, date])

  async function save() {
    setSaving(true)
    try {
      await logSend(target, {
        date: date || todayIso(),
        subject,
        body: target.draftBody,
      })
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Couldn’t log that email.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFirst ? 'Log your email' : 'Log a follow-up'}</DialogTitle>
          <DialogDescription>
            {isFirst
              ? `When your email to ${targetName(target)} went out.`
              : `When you followed up with ${targetName(target)}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="cold-sent-on">Sent on</Label>
            <Input
              id="cold-sent-on"
              type="date"
              className="tnum"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cold-sent-subject">Subject</Label>
            <Input id="cold-sent-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          {preview && <p className="text-xs text-muted-foreground">{preview}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving || !date}>
              Log it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
