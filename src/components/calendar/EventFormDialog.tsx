import * as React from 'react'
import { toast } from 'sonner'
import { Search, Trash2, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts } from '@/hooks/useData'
import { eventRepo } from '@/services'
import { fullName } from '@/lib/format'
import type { CalendarEvent } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing an existing meeting, or undefined to create a new one. */
  event?: CalendarEvent | null
  /** Pre-fill the date (yyyy-mm-dd) when creating from a day cell. */
  defaultDate?: string
  /** Pre-link a contact (e.g. scheduling from their profile). */
  defaultContactId?: string
}

/** Split an ISO datetime into local date + time parts for the form inputs. */
function splitLocal(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Combine local date + time inputs back into an ISO datetime. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultContactId,
}: Props) {
  const contacts = useContacts() ?? []
  const editing = Boolean(event)

  const [title, setTitle] = React.useState('')
  const [date, setDate] = React.useState(todayStr())
  const [start, setStart] = React.useState('09:00')
  const [end, setEnd] = React.useState('09:30')
  const [allDay, setAllDay] = React.useState(false)
  const [location, setLocation] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [contactIds, setContactIds] = React.useState<string[]>([])
  const [query, setQuery] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (event) {
      const s = splitLocal(event.startsAt)
      const e = splitLocal(event.endsAt)
      setTitle(event.title)
      setDate(s.date)
      setStart(s.time)
      setEnd(e.time)
      setAllDay(event.allDay)
      setLocation(event.location ?? '')
      setDescription(event.description ?? '')
      setContactIds(event.contactIds)
    } else {
      setTitle('')
      setDate(defaultDate || todayStr())
      setStart('09:00')
      setEnd('09:30')
      setAllDay(false)
      setLocation('')
      setDescription('')
      setContactIds(defaultContactId ? [defaultContactId] : [])
    }
    setQuery('')
  }, [open, event, defaultDate, defaultContactId])

  const selected = contactIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter(Boolean) as NonNullable<(typeof contacts)[number]>[]

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return contacts
      .filter((c) => !contactIds.includes(c.id))
      .filter((c) => `${fullName(c)} ${c.company ?? ''}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [contacts, contactIds, query])

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const startsAt = allDay ? toIso(date, '00:00') : toIso(date, start)
      const endsAt = allDay ? toIso(date, '23:59') : toIso(date, end || start)
      const draft = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startsAt,
        endsAt,
        allDay,
        contactIds,
        logged: event?.logged ?? false,
      }
      if (event) await eventRepo.update(event.id, draft)
      else await eventRepo.create(draft)
      toast.success(editing ? 'Meeting updated' : 'Meeting scheduled')
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save this meeting.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!event) return
    setSaving(true)
    try {
      await eventRepo.remove(event.id)
      toast.success('Meeting deleted')
      onOpenChange(false)
    } catch {
      toast.error('Could not delete this meeting.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit meeting' : 'Schedule a meeting'}</DialogTitle>
          <DialogDescription>
            Link the people you're meeting — it shows on their profile and syncs
            to your calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Coffee chat with Priya"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-start">Start</Label>
                  <Input
                    id="ev-start"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-end">End</Label>
                  <Input
                    id="ev-end"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-indigo-500"
            />
            All day
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location or link</Label>
            <Input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Campus center, or a Zoom link"
            />
          </div>

          {/* Attendees */}
          <div className="space-y-1.5">
            <Label>People</Label>
            {selected.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selected.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-accent/40 py-1 pl-1 pr-2 text-xs"
                  >
                    <ContactAvatar contact={c} className="h-5 w-5 text-[9px]" />
                    {fullName(c)}
                    <button
                      onClick={() =>
                        setContactIds((ids) => ids.filter((id) => id !== c.id))
                      }
                      aria-label={`Remove ${fullName(c)}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts to add…"
                className="pl-9"
              />
            </div>
            {results.length > 0 && (
              <div className="mt-1 space-y-0.5 rounded-lg border p-1">
                {results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setContactIds((ids) => [...ids, c.id])
                      setQuery('')
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <ContactAvatar contact={c} className="h-6 w-6 text-[10px]" />
                    <span className="truncate">{fullName(c)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Notes</Label>
            <Textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda, what to ask about…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          {editing && (
            <Button
              variant="ghost"
              onClick={() => void remove()}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button onClick={() => void save()} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
