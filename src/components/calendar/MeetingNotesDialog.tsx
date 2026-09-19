import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SheetBar,
  SheetBarButton,
} from '@/components/ui/dialog'
import { InsetGroup, InsetTextareaRow } from '@/components/ui/inset-list'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useContacts } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { fullName } from '@/lib/format'
import { saveMeetingNotes } from '@/lib/meetingNotes'
import type { CalendarEvent } from '@/types'

const PLACEHOLDER = 'What you talked about, what they suggested, next steps…'

/**
 * Jot down how a meeting went. The notes live on the meeting and are copied
 * onto each attendee's timeline, so they turn up on the person's profile too.
 */
export function MeetingNotesDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEvent | null
}) {
  const contacts = useContacts() ?? []
  const isMobile = useIsMobile()
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) setNotes(event?.notes ?? '')
  }, [open, event])

  if (!event) return null

  const people = event.contactIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c) => c !== undefined)
  const when = format(parseISO(event.startsAt), event.allDay ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a')
  const subtitle = [when, people.map(fullName).join(', ')].filter(Boolean).join(' · ')

  async function save() {
    if (!event) return
    setSaving(true)
    try {
      await saveMeetingNotes(event, notes, contacts)
      toast.success(notes.trim() ? 'Meeting notes saved' : 'Meeting notes cleared')
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save these notes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isMobile ? (
        <DialogContent tall hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
          <DialogHeader>
            <SheetBar
              leading={<SheetBarButton close>Cancel</SheetBarButton>}
              title="Meeting Notes"
              trailing={
                <SheetBarButton strong disabled={saving} onClick={() => void save()}>
                  Save
                </SheetBarButton>
              }
            />
          </DialogHeader>
          <div className="space-y-2 px-4 pb-8 pt-1">
            <p className="text-ios-headline px-1">{event.title}</p>
            <p className="text-ios-footnote px-1 pb-2 text-muted-foreground">{subtitle}</p>
            <InsetGroup footer={people.length ? 'Also added to their timelines.' : undefined}>
              <InsetTextareaRow value={notes} onChange={setNotes} placeholder={PLACEHOLDER} rows={10} last />
            </InsetGroup>
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notes · {event.title}</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
            }}
            placeholder={PLACEHOLDER}
            rows={8}
          />
          {people.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Also added to {people.length === 1 ? `${fullName(people[0])}’s` : 'their'} timeline.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
