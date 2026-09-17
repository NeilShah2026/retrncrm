import * as React from 'react'
import { toast } from 'sonner'
import { Check, Search, Trash2, Undo2 } from 'lucide-react'
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
import {
  InsetDateRow,
  InsetGroup,
  InsetInputRow,
  InsetRow,
  InsetTextareaRow,
} from '@/components/ui/inset-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { followUpRepo } from '@/services'
import { fullName } from '@/lib/format'
import { describeDue, dueInSentence, parseDatePhrase, quickDates } from '@/lib/followUps'
import { ensureReminderPermission } from '@/lib/reminderNotifications'
import { selectionFeedback, successFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { Contact, FollowUp } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing an existing follow-up, or absent to create one. */
  followUp?: FollowUp | null
  /** Who it's for. Absent → the sheet asks. */
  contactId?: string
}

/**
 * "Email her back in December" as a thing with a date on it.
 *
 * What to do comes first, because that's how people say it — and if the words
 * already carry a date ("…in December", "next Tuesday"), the date fills itself
 * in, until someone picks one by hand.
 */
export function FollowUpDialog({ open, onOpenChange, followUp, contactId }: Props) {
  const isMobile = useIsMobile()
  const loaded = useContacts()
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const editing = Boolean(followUp)

  const [who, setWho] = React.useState<string | undefined>(contactId)
  const [note, setNote] = React.useState('')
  const [dueDate, setDueDate] = React.useState<string | undefined>()
  /** The phrase the date was read from; null once the date was picked by hand. */
  const [readFrom, setReadFrom] = React.useState<string | null>(null)
  const [manualDate, setManualDate] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setWho(followUp?.contactId ?? contactId)
    setNote(followUp?.note ?? '')
    setDueDate(followUp?.dueDate)
    setManualDate(Boolean(followUp))
    setReadFrom(null)
    setQuery('')
  }, [open, followUp, contactId])

  const person = contacts.find((c) => c.id === who)
  const choices = React.useMemo(() => quickDates(), [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function changeNote(value: string) {
    setNote(value)
    if (manualDate) return
    const parsed = parseDatePhrase(value)
    if (parsed) {
      setDueDate(parsed.date)
      setReadFrom(parsed.phrase.trim())
    } else if (readFrom) {
      // The phrase was deleted again: so is the date it set.
      setDueDate(undefined)
      setReadFrom(null)
    }
  }

  function pickDate(date: string | undefined) {
    selectionFeedback()
    setDueDate(date)
    setManualDate(true)
    setReadFrom(null)
  }

  const canSave = Boolean(who && dueDate) && !saving

  async function save() {
    if (!who || !dueDate) return
    setSaving(true)
    try {
      const draft = { contactId: who, dueDate, note: note.trim() || undefined }
      if (followUp) {
        await followUpRepo.update(followUp.id, draft)
        toast.success('Follow-up updated')
      } else {
        await followUpRepo.create({ ...draft, completedAt: undefined })
        successFeedback()
        toast.success(`Follow-up set for ${dueInSentence(dueDate)}`)
        // The moment a reminder is obviously worth having is the moment to ask.
        void ensureReminderPermission()
      }
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Couldn’t save this follow-up.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleDone() {
    if (!followUp) return
    setSaving(true)
    try {
      await followUpRepo.update(followUp.id, {
        completedAt: followUp.completedAt ? undefined : new Date().toISOString(),
      })
      toast.success(followUp.completedAt ? 'Marked as not done' : 'Done')
      onOpenChange(false)
    } catch {
      toast.error('Couldn’t update this follow-up.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!followUp) return
    setSaving(true)
    try {
      await followUpRepo.remove(followUp.id)
      toast.success('Follow-up deleted')
      onOpenChange(false)
    } catch {
      toast.error('Couldn’t delete this follow-up.')
    } finally {
      setSaving(false)
    }
  }

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return contacts
      .filter((c) => `${fullName(c)} ${c.company ?? ''}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [contacts, query])

  const dateHint = readFrom ? `From “${readFrom}”` : undefined
  const title = editing ? 'Follow-up' : 'New Follow-up'

  function renderPhone() {
    return (
      <DialogContent tall hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
        <DialogHeader>
          <SheetBar
            leading={<SheetBarButton close>Cancel</SheetBarButton>}
            title={title}
            trailing={
              <SheetBarButton strong disabled={!canSave} onClick={() => void save()}>
                {editing ? 'Done' : 'Add'}
              </SheetBarButton>
            }
          />
        </DialogHeader>

        <div className="space-y-6 px-4 pb-8 pt-1">
          {!contactId && !editing && (
            <InsetGroup title="Who">
              {person ? (
                <InsetRow
                  leading={<ContactAvatar contact={person} className="h-7 w-7 text-[11px]" />}
                  title={fullName(person)}
                  chevron={false}
                  accessory={<span className="text-ios-subhead text-brand">Change</span>}
                  last
                  onClick={() => setWho(undefined)}
                />
              ) : (
                <>
                  <InsetInputRow
                    value={query}
                    onChange={setQuery}
                    placeholder="Search contacts…"
                    autoCapitalize="words"
                    last={matches.length === 0}
                  />
                  {matches.map((c, i) => (
                    <PersonRow
                      key={c.id}
                      contact={c}
                      last={i === matches.length - 1}
                      onPick={() => {
                        setWho(c.id)
                        setQuery('')
                      }}
                    />
                  ))}
                </>
              )}
            </InsetGroup>
          )}

          <InsetGroup
            title={person && (contactId || editing) ? `With ${person.firstName}` : 'What to do'}
          >
            <InsetTextareaRow
              value={note}
              onChange={changeNote}
              placeholder="Email back about the internship in December"
              rows={2}
              last
            />
          </InsetGroup>

          <InsetGroup title="When" footer={dateHint}>
            <div className="hairline-b flex flex-wrap gap-2 px-4 py-3">
              {choices.map((c) => (
                <DateChip
                  key={c.label}
                  label={c.label}
                  selected={dueDate === c.date}
                  onClick={() => pickDate(c.date)}
                />
              ))}
            </div>
            <InsetDateRow label="Due" value={dueDate} onChange={pickDate} placeholder="Pick a date" last />
          </InsetGroup>

          {editing && (
            <InsetGroup>
              <InsetRow
                title={followUp?.completedAt ? 'Mark as Not Done' : 'Mark as Done'}
                centered
                disabled={saving}
                onClick={() => void toggleDone()}
              />
              <InsetRow
                title="Delete Follow-up"
                destructive
                centered
                last
                disabled={saving}
                onClick={() => void remove()}
              />
            </InsetGroup>
          )}
        </div>
      </DialogContent>
    )
  }

  function renderDesktop() {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit follow-up' : 'Set a follow-up'}</DialogTitle>
          <DialogDescription>
            {person
              ? `A reminder to get back to ${person.firstName} on a date.`
              : 'A reminder to get back to someone on a date.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-1">
          {!contactId && !editing && (
            <div className="space-y-1.5">
              <Label>Who</Label>
              {person ? (
                <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
                  <span className="flex items-center gap-2 text-sm">
                    <ContactAvatar contact={person} className="h-6 w-6 text-[10px]" />
                    {fullName(person)}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setWho(undefined)}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search contacts…"
                      className="pl-9"
                    />
                  </div>
                  {matches.length > 0 && (
                    <div className="space-y-0.5 rounded-lg border p-1">
                      {matches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setWho(c.id)
                            setQuery('')
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                        >
                          <ContactAvatar contact={c} className="h-6 w-6 text-[10px]" />
                          <span className="truncate">{fullName(c)}</span>
                          {c.company && (
                            <span className="truncate text-xs text-muted-foreground">{c.company}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fu-note">What to do</Label>
            <Textarea
              id="fu-note"
              autoFocus={Boolean(contactId) || editing}
              value={note}
              onChange={(e) => changeNote(e.target.value)}
              placeholder="Email back about the internship in December"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fu-date">When</Label>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((c) => (
                <DateChip
                  key={c.label}
                  label={c.label}
                  selected={dueDate === c.date}
                  onClick={() => pickDate(c.date)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="fu-date"
                type="date"
                value={dueDate ?? ''}
                onChange={(e) => pickDate(e.target.value || undefined)}
                className="w-44"
              />
              {dueDate && (
                <span className="text-xs text-muted-foreground">
                  {describeDue(dueDate)}
                  {dateHint ? ` · ${dateHint}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {editing ? (
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => void remove()} disabled={saving} className="text-danger hover:text-danger">
                <Trash2 />
                Delete
              </Button>
              <Button variant="ghost" onClick={() => void toggleDone()} disabled={saving}>
                {followUp?.completedAt ? <Undo2 /> : <Check />}
                {followUp?.completedAt ? 'Not done' : 'Done'}
              </Button>
            </div>
          ) : (
            <span />
          )}
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving ? 'Saving…' : editing ? 'Save' : 'Set follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isMobile ? renderPhone() : renderDesktop()}
    </Dialog>
  )
}

function DateChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'press rounded-full px-3 py-1.5 text-sm transition-colors duration-fast md:px-2.5 md:py-1 md:text-xs',
        selected
          ? 'bg-brand text-brand-foreground'
          : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]',
      )}
    >
      {label}
    </button>
  )
}

function PersonRow({
  contact,
  last,
  onPick,
}: {
  contact: Contact
  last: boolean
  onPick: () => void
}) {
  return (
    <InsetRow
      leading={<ContactAvatar contact={contact} className="h-7 w-7 text-[11px]" />}
      title={contact.company ? `${fullName(contact)} · ${contact.company}` : fullName(contact)}
      chevron={false}
      last={last}
      onClick={onPick}
    />
  )
}

