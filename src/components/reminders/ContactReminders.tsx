import * as React from 'react'
import { AlarmClock, AlarmClockPlus, Cake, CalendarHeart, Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSection } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InsetGroup, InsetRow } from '@/components/ui/inset-list'
import { FollowUpDialog } from './FollowUpDialog'
import { KeyDateDialog } from './KeyDateDialog'
import { completeFollowUp, snoozeFollowUp } from './followUpActions'
import { useFollowUps, useKeyDates } from '@/hooks/useData'
import { describeDue, followUpState, snoozeChoices, sortFollowUps } from '@/lib/followUps'
import { daysUntilKeyDate, describeUpcoming, formatKeyDate, milestone } from '@/lib/keyDates'
import { cn } from '@/lib/utils'
import type { Contact, FollowUp, KeyDate } from '@/types'

/**
 * A contact's follow-ups and key dates, in both of the contact page's shapes:
 * iOS grouped rows on a phone, panel sections on a desktop. Each owns its
 * add/edit sheet, so the page only has to place them.
 */

function useContactReminders(contactId: string) {
  const followUps = useFollowUps()
  const keyDates = useKeyDates()
  return {
    open: sortFollowUps((followUps ?? []).filter((f) => f.contactId === contactId && !f.completedAt)),
    dates: (keyDates ?? [])
      .filter((k) => k.contactId === contactId)
      .sort((a, b) => daysUntilKeyDate(a) - daysUntilKeyDate(b)),
  }
}

/** Imperative handle so the page's own buttons ("Follow up" in a menu) can open the sheet. */
export interface ReminderSheets {
  addFollowUp: () => void
}

function useSheets(contact: Contact) {
  const [followUpOpen, setFollowUpOpen] = React.useState(false)
  const [editingFollowUp, setEditingFollowUp] = React.useState<FollowUp | null>(null)
  const [keyDateOpen, setKeyDateOpen] = React.useState(false)
  const [editingKeyDate, setEditingKeyDate] = React.useState<KeyDate | null>(null)

  const sheets = (
    <>
      <FollowUpDialog open={followUpOpen} onOpenChange={setFollowUpOpen} contactId={contact.id} />
      <FollowUpDialog
        open={Boolean(editingFollowUp)}
        onOpenChange={(o) => !o && setEditingFollowUp(null)}
        followUp={editingFollowUp}
        contactId={contact.id}
      />
      <KeyDateDialog
        open={keyDateOpen}
        onOpenChange={setKeyDateOpen}
        contactId={contact.id}
        firstName={contact.firstName}
      />
      <KeyDateDialog
        open={Boolean(editingKeyDate)}
        onOpenChange={(o) => !o && setEditingKeyDate(null)}
        contactId={contact.id}
        firstName={contact.firstName}
        keyDate={editingKeyDate}
      />
    </>
  )

  return {
    sheets,
    addFollowUp: () => setFollowUpOpen(true),
    editFollowUp: setEditingFollowUp,
    addKeyDate: () => setKeyDateOpen(true),
    editKeyDate: setEditingKeyDate,
  }
}

function DoneCircle({ label, onClick, large }: { label: string; onClick: () => void; large?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Done"
      className="press group flex h-11 w-9 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full ring-[1.5px] ring-inset ring-border-strong transition-colors duration-fast group-hover:bg-brand/10 group-hover:ring-brand',
          large ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]',
        )}
      >
        <Check
          className={cn('text-brand opacity-0 group-hover:opacity-100', large ? 'h-3.5 w-3.5' : 'h-3 w-3')}
          strokeWidth={3}
        />
      </span>
    </button>
  )
}

function dueClass(f: FollowUp): string | undefined {
  const state = followUpState(f)
  return state === 'overdue' || state === 'today' ? 'font-medium text-warning' : undefined
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export function PhoneContactReminders({ contact }: { contact: Contact }) {
    const { open, dates } = useContactReminders(contact.id)
    const s = useSheets(contact)

    return (
      <>
        <InsetGroup title="Follow-ups">
          {open.map((f) => (
            <div key={f.id} className="flex items-stretch pl-1.5">
              <span className="flex items-center">
                <DoneCircle
                  large
                  label={`Mark “${f.note ?? 'follow up'}” done`}
                  onClick={() => void completeFollowUp(f, contact)}
                />
              </span>
              <button
                type="button"
                onClick={() => s.editFollowUp(f)}
                className="press-row hairline-b flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 pr-4 text-left"
              >
                <span className="text-ios-body truncate">{f.note || `Follow up with ${contact.firstName}`}</span>
                <span className={cn('text-ios-footnote text-muted-foreground', dueClass(f))}>
                  {describeDue(f.dueDate)}
                </span>
              </button>
            </div>
          ))}
          <InsetRow
            leading={<AlarmClockPlus className="h-[18px] w-[18px] text-brand" strokeWidth={2} />}
            title={<span className="text-brand">Set a Follow-up</span>}
            chevron={false}
            last
            onClick={s.addFollowUp}
          />
        </InsetGroup>

        <InsetGroup title="Birthday & dates">
          {dates.map((k) => (
            <InsetRow
              key={k.id}
              title={k.label}
              subtitle={[formatKeyDate(k), milestone(k)].filter(Boolean).join(' · ')}
              detail={daysUntilKeyDate(k) <= 30 ? describeUpcoming(k) : undefined}
              onClick={() => s.editKeyDate(k)}
            />
          ))}
          <InsetRow
            leading={<CalendarHeart className="h-[18px] w-[18px] text-brand" strokeWidth={2} />}
            title={<span className="text-brand">Add Birthday or Date</span>}
            chevron={false}
            last
            onClick={s.addKeyDate}
          />
        </InsetGroup>

        {s.sheets}
      </>
    )
}

// ---------------------------------------------------------------------------
// Desktop
// ---------------------------------------------------------------------------

export const DesktopFollowUps = React.forwardRef<ReminderSheets, { contact: Contact }>(
  function DesktopFollowUps({ contact }, ref) {
    const { open } = useContactReminders(contact.id)
    const s = useSheets(contact)
    React.useImperativeHandle(ref, () => ({ addFollowUp: s.addFollowUp }), [s.addFollowUp])

    return (
      <PanelSection className="px-0 py-0">
        <div className="flex h-11 items-center justify-between px-4">
          <h2 className="text-label text-muted-foreground">
            Follow-ups
            {open.length > 0 && <span className="tnum ml-2 font-normal">{open.length}</span>}
          </h2>
          <Button size="sm" variant="ghost" onClick={s.addFollowUp}>
            <AlarmClockPlus />
            Follow up
          </Button>
        </div>
        {open.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Nothing set. Said you’d get back to {contact.firstName} on a date? Set a follow-up and it
            lands on your dashboard, and your phone, that day.
          </p>
        ) : (
          <ul className="border-t">
            {open.map((f) => (
              <li key={f.id} className="group flex items-center gap-1 border-b pl-2 pr-3 last:border-b-0 hover:bg-accent/40">
                <DoneCircle
                  label={`Mark “${f.note ?? 'follow up'}” done`}
                  onClick={() => void completeFollowUp(f, contact)}
                />
                <button
                  type="button"
                  onClick={() => s.editFollowUp(f)}
                  className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 py-2 text-left focus-visible:outline-none"
                >
                  <span className="truncate text-sm">{f.note || `Follow up with ${contact.firstName}`}</span>
                  <span className={cn('tnum shrink-0 text-xs text-muted-foreground', dueClass(f))}>
                    {describeDue(f.dueDate)}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Snooze"
                      title="Snooze"
                      className="text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
                    >
                      <AlarmClock />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Remind me again
                    </DropdownMenuLabel>
                    {snoozeChoices().map((c) => (
                      <DropdownMenuItem key={c.label} onClick={() => void snoozeFollowUp(f, c.date)}>
                        {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
        {s.sheets}
      </PanelSection>
    )
  },
)

export function DesktopKeyDates({ contact }: { contact: Contact }) {
  const { dates } = useContactReminders(contact.id)
  const s = useSheets(contact)

  return (
    <PanelSection className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-label text-muted-foreground">Birthday & dates</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={s.addKeyDate}
          aria-label="Add a birthday or date"
          title="Add a birthday or date"
          className="text-muted-foreground"
        >
          <Plus />
        </Button>
      </div>
      {dates.length === 0 ? (
        <button type="button" onClick={s.addKeyDate} className="text-left text-xs text-muted-foreground hover:text-foreground">
          Add a birthday and get a reminder each year.
        </button>
      ) : (
        dates.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => s.editKeyDate(k)}
            className="flex w-full items-start justify-between gap-3 rounded-sm text-left text-sm hover:text-brand"
          >
            <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
              {/birthday/i.test(k.label) ? <Cake className="h-3.5 w-3.5" /> : <CalendarHeart className="h-3.5 w-3.5" />}
              {k.label}
            </span>
            <span className="min-w-0 text-right">
              {formatKeyDate(k)}
              {milestone(k) && daysUntilKeyDate(k) <= 30 && (
                <span className="block text-xs text-muted-foreground">
                  {milestone(k)} · {describeUpcoming(k)}
                </span>
              )}
            </span>
          </button>
        ))
      )}
      {s.sheets}
    </PanelSection>
  )
}
