import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, Cake, Check, Plus } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { FollowUpDialog } from '@/components/reminders/FollowUpDialog'
import { completeFollowUp, snoozeFollowUp } from '@/components/reminders/followUpActions'
import { daysUntilDue, describeDue, followUpState, snoozeChoices } from '@/lib/followUps'
import { describeUpcoming, milestone, upcomingKeyDates } from '@/lib/keyDates'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact, FollowUp, KeyDate } from '@/types'

/** How far ahead the dashboard looks before a follow-up counts as "later". */
const HORIZON_DAYS = 14
const LIMIT = 6

/**
 * The promises with dates on them: everything overdue, due today, or due in
 * the next two weeks. Each can be finished or pushed back without leaving
 * the dashboard.
 */
export function FollowUpsPanel({
  followUps,
  contactMap,
}: {
  followUps: FollowUp[]
  contactMap: Map<string, Contact>
}) {
  const navigate = useNavigate()
  const [adding, setAdding] = React.useState(false)
  const [editing, setEditing] = React.useState<FollowUp | null>(null)

  const open = followUps.filter((f) => !f.completedAt && contactMap.has(f.contactId))
  const soon = open.filter((f) => daysUntilDue(f.dueDate) <= HORIZON_DAYS)
  const shown = soon.slice(0, LIMIT)
  const later = open.length - shown.length

  return (
    <Panel>
      <PanelHeader
        action={
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add
          </Button>
        }
      >
        Follow-ups
      </PanelHeader>

      {shown.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {open.length > 0
            ? `Nothing due in the next two weeks. ${open.length} set for later.`
            : 'Nothing due. When someone says “get back to me in December”, set a follow-up from their page — or tell the assistant.'}
        </p>
      ) : (
        <ul>
          {shown.map((f) => {
            const contact = contactMap.get(f.contactId)!
            const state = followUpState(f)
            const late = state === 'overdue' || state === 'today'
            return (
              <li
                key={f.id}
                className="flex items-center gap-2 border-b pl-2 pr-3 last:border-b-0 hover:bg-accent/50"
              >
                <button
                  type="button"
                  onClick={() => void completeFollowUp(f, contact)}
                  aria-label={`Mark follow-up with ${fullName(contact)} done`}
                  title="Done"
                  className="press group flex h-11 w-9 shrink-0 items-center justify-center"
                >
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full ring-[1.5px] ring-inset ring-border-strong transition-colors duration-fast group-hover:bg-brand/10 group-hover:ring-brand">
                    <Check className="h-3 w-3 text-brand opacity-0 group-hover:opacity-100" strokeWidth={3} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(f)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-2 text-left focus-visible:outline-none"
                >
                  <ContactAvatar contact={contact} className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {f.note || `Follow up with ${contact.firstName}`}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span
                        role="link"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(ROUTES.contact(contact.id))
                        }}
                        className="hover:text-foreground hover:underline"
                      >
                        {fullName(contact)}
                      </span>
                      {' · '}
                      <span className={cn(late && 'font-medium text-warning')}>{describeDue(f.dueDate)}</span>
                    </span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Snooze follow-up with ${fullName(contact)}`}
                      title="Snooze"
                      className="text-muted-foreground"
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
            )
          })}
          {later > 0 && (
            <li className="px-4 py-2 text-xs text-muted-foreground">
              {later} more {later === 1 ? 'follow-up' : 'follow-ups'} set
            </li>
          )}
        </ul>
      )}

      <FollowUpDialog open={adding} onOpenChange={setAdding} />
      <FollowUpDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        followUp={editing}
      />
    </Panel>
  )
}

/** Birthdays and anniversaries in the next month. */
export function ComingUpPanel({
  keyDates,
  contactMap,
}: {
  keyDates: KeyDate[]
  contactMap: Map<string, Contact>
}) {
  const navigate = useNavigate()
  const upcoming = upcomingKeyDates(
    keyDates.filter((k) => contactMap.has(k.contactId)),
    30,
  ).slice(0, 5)

  return (
    <Panel>
      <PanelHeader>Coming up</PanelHeader>
      {upcoming.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {keyDates.length === 0
            ? 'Add birthdays from anyone’s page, or bring them in when you import your phone’s contacts.'
            : 'No birthdays or dates in the next month.'}
        </p>
      ) : (
        <ul>
          {upcoming.map(({ keyDate, days }) => {
            const contact = contactMap.get(keyDate.contactId)!
            const extra = milestone(keyDate)
            return (
              <li key={keyDate.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.contact(contact.id))}
                  className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2 text-left transition-colors duration-fast hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                >
                  <ContactAvatar contact={contact} className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{fullName(contact)}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {/birthday/i.test(keyDate.label) && <Cake className="h-3 w-3 shrink-0" />}
                      {keyDate.label}
                      {extra ? ` · ${extra}` : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'tnum shrink-0 text-xs',
                      days <= 1 ? 'font-medium text-brand' : 'text-muted-foreground',
                    )}
                  >
                    {describeUpcoming(keyDate)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
