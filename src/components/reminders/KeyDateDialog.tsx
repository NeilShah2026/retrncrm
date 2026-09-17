import * as React from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
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
import { InsetGroup, InsetInputRow, InsetRow, InsetSelectRow } from '@/components/ui/inset-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/useIsMobile'
import { keyDateRepo } from '@/services'
import { KEY_DATE_LABELS, MONTH_NAMES, daysInMonth } from '@/lib/keyDates'
import { ensureReminderPermission } from '@/lib/reminderNotifications'
import { selectionFeedback, successFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import type { KeyDate } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  /** First name, for the copy. */
  firstName: string
  keyDate?: KeyDate | null
}

const OTHER = '__other__'

/** A birthday, an anniversary — month and day, and a year if it's known. */
export function KeyDateDialog({ open, onOpenChange, contactId, firstName, keyDate }: Props) {
  const isMobile = useIsMobile()
  const editing = Boolean(keyDate)

  const [preset, setPreset] = React.useState<string>('Birthday')
  const [custom, setCustom] = React.useState('')
  const [month, setMonth] = React.useState('')
  const [day, setDay] = React.useState('')
  const [year, setYear] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const label = keyDate?.label ?? 'Birthday'
    const known = (KEY_DATE_LABELS as readonly string[]).includes(label)
    setPreset(known ? label : OTHER)
    setCustom(known ? '' : label)
    setMonth(keyDate ? String(keyDate.month) : '')
    setDay(keyDate ? String(keyDate.day) : '')
    setYear(keyDate?.year ? String(keyDate.year) : '')
  }, [open, keyDate])

  const label = preset === OTHER ? custom.trim() : preset
  const m = Number(month)
  const d = Number(day)
  const y = year.trim() ? Number(year) : undefined
  const yearValid = y === undefined || (Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear() + 1)
  const valid = Boolean(label) && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(m) && yearValid

  // A day that no longer exists in the newly chosen month is cleared, not kept.
  React.useEffect(() => {
    if (m && d > daysInMonth(m)) setDay('')
  }, [m, d])

  async function save() {
    if (!valid) return
    setSaving(true)
    try {
      const draft = { contactId, label, month: m, day: d, year: y }
      if (keyDate) {
        await keyDateRepo.update(keyDate.id, draft)
        toast.success('Date updated')
      } else {
        await keyDateRepo.create(draft)
        successFeedback()
        toast.success(`${label} saved — you’ll be reminded each year`)
        void ensureReminderPermission()
      }
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Couldn’t save this date.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!keyDate) return
    setSaving(true)
    try {
      await keyDateRepo.remove(keyDate.id)
      toast.success('Date deleted')
      onOpenChange(false)
    } catch {
      toast.error('Couldn’t delete this date.')
    } finally {
      setSaving(false)
    }
  }

  const monthOptions = MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))
  const dayOptions = Array.from({ length: m ? daysInMonth(m) : 31 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }))

  const labelChips = (
    <div className="flex flex-wrap gap-2">
      {[...KEY_DATE_LABELS, OTHER].map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={preset === l}
          onClick={() => {
            selectionFeedback()
            setPreset(l)
          }}
          className={cn(
            'press rounded-full px-3 py-1.5 text-sm transition-colors duration-fast md:px-2.5 md:py-1 md:text-xs',
            preset === l
              ? 'bg-brand text-brand-foreground'
              : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]',
          )}
        >
          {l === OTHER ? 'Other' : l}
        </button>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isMobile ? (
        <DialogContent tall hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
          <DialogHeader>
            <SheetBar
              leading={<SheetBarButton close>Cancel</SheetBarButton>}
              title={editing ? 'Edit Date' : 'Add Date'}
              trailing={
                <SheetBarButton strong disabled={!valid || saving} onClick={() => void save()}>
                  {editing ? 'Done' : 'Add'}
                </SheetBarButton>
              }
            />
          </DialogHeader>
          <div className="space-y-6 px-4 pb-8 pt-1">
            <InsetGroup title={`${firstName}’s`}>
              <div className={cn('px-4 py-3', preset === OTHER && 'hairline-b')}>{labelChips}</div>
              {preset === OTHER && (
                <InsetInputRow
                  value={custom}
                  onChange={setCustom}
                  placeholder="What it is, e.g. Moved to Boston"
                  autoCapitalize="sentences"
                  last
                />
              )}
            </InsetGroup>
            <InsetGroup footer="Leave the year blank if you don’t know it. You’ll get a reminder at 9am on the day, every year.">
              <InsetSelectRow label="Month" value={month} onChange={setMonth} options={monthOptions} placeholder="Choose" />
              <InsetSelectRow label="Day" value={day} onChange={setDay} options={dayOptions} placeholder="Choose" />
              <InsetInputRow
                label="Year"
                value={year}
                onChange={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
                placeholder="Optional"
                inputMode="numeric"
                enterKeyHint="done"
                last
              />
            </InsetGroup>
            {editing && (
              <InsetGroup>
                <InsetRow title="Delete Date" destructive centered last disabled={saving} onClick={() => void remove()} />
              </InsetGroup>
            )}
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit date' : `Add a date for ${firstName}`}</DialogTitle>
            <DialogDescription>A birthday or anniversary, remembered every year.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pb-1">
            <div className="space-y-1.5">
              <Label>What</Label>
              {labelChips}
              {preset === OTHER && (
                <Input
                  autoFocus
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="e.g. Moved to Boston"
                />
              )}
            </div>
            <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="kd-month">Month</Label>
                <select
                  id="kd-month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Month</option>
                  {monthOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kd-day">Day</Label>
                <select
                  id="kd-day"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Day</option>
                  {dayOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kd-year">Year</Label>
                <Input
                  id="kd-year"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {editing ? (
              <Button variant="ghost" onClick={() => void remove()} disabled={saving} className="text-danger hover:text-danger">
                <Trash2 />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void save()} disabled={!valid || saving}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Add date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
