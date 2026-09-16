import * as React from 'react'
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  KanbanSquare,
  NotebookPen,
  Tag as TagIcon,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SuggestedBadge } from '@/components/ui/badge'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { markCaughtUp } from '@/lib/caughtUp'
import { describeAction, type ActionOutcome, type AssistantAction } from '@/lib/ai/actions'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

/**
 * The things the assistant can put inside a message: a plan you can edit and
 * run, the people it found, a receipt for what was saved. They look like the
 * rest of the product — hairline panels, rows — not like chat bubbles.
 */

const ACTION_ICON: Record<AssistantAction['type'], typeof UserPlus> = {
  add_contact: UserPlus,
  schedule_meeting: CalendarPlus,
  log_caught_up: Check,
  add_note: NotebookPen,
  add_tags: TagIcon,
  set_followup: Clock,
  add_opportunity: KanbanSquare,
}

export function ActionPlan({
  actions,
  chosen,
  applying,
  outcomes,
  onToggle,
  onRun,
  onGo,
}: {
  actions: AssistantAction[]
  chosen: boolean[]
  applying: boolean
  outcomes?: ActionOutcome[]
  onToggle: (index: number) => void
  onRun: () => void
  onGo: (route: string) => void
}) {
  if (outcomes) {
    const saved = outcomes.filter((o) => o.status === 'done').length
    return (
      <div className="overflow-hidden rounded-[16px] bg-grouped-cell ring-1 ring-inset ring-border/60">
        <div className="flex h-11 items-center gap-2 border-b bg-success-soft/60 px-4">
          <CheckCircle2 className="h-4 w-4 text-success md:h-3.5 md:w-3.5" />
          <span className="text-ios-footnote font-medium text-success md:text-xs">
            {saved === outcomes.length
              ? saved === 1
                ? 'Saved'
                : `Saved all ${saved}`
              : `Saved ${saved} of ${outcomes.length}`}
          </span>
        </div>
        <ul>
          {outcomes.map((outcome, i) => {
            const ok = outcome.status === 'done'
            return (
              <li
                key={i}
                className="text-ios-subhead flex items-start gap-2.5 border-b px-3.5 py-2.5 last:border-b-0 md:gap-2 md:px-3 md:py-2 md:text-sm"
              >
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn(!ok && 'text-muted-foreground')}>{outcome.message}</span>
                  {outcome.route && ok && (
                    <button
                      type="button"
                      onClick={() => onGo(outcome.route!)}
                      className="ml-1.5 font-medium text-brand hover:underline md:text-xs"
                    >
                      Open
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const count = chosen.filter(Boolean).length
  return (
    <div className="overflow-hidden rounded-[16px] bg-grouped-cell ring-1 ring-inset ring-border/60">
      <div className="flex h-11 items-center justify-between gap-2 border-b px-4">
        <span className="text-ios-footnote flex items-center gap-2 font-medium text-text-secondary md:text-xs">
          About to save
          <SuggestedBadge />
        </span>
        <span className="tnum text-ios-footnote text-muted-foreground md:text-xs">
          {count} of {actions.length}
        </span>
      </div>

      <ul>
        {actions.map((action, i) => {
          const { label, detail } = describeAction(action)
          const Icon = ACTION_ICON[action.type]
          const on = chosen[i]
          return (
            <li key={i} className="border-b last:border-b-0">
              <button
                type="button"
                disabled={applying}
                aria-pressed={on}
                onClick={() => onToggle(i)}
                className={cn(
                  'flex w-full items-start gap-3 px-3.5 py-3 text-left transition-[opacity,background-color] duration-fast active:bg-accent/70 focus-visible:bg-accent focus-visible:outline-none md:gap-2.5 md:px-3 md:py-2',
                  on ? 'md:hover:bg-accent/60' : 'opacity-50 md:hover:opacity-80',
                )}
              >
                <span
                  className={cn(
                    'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-fast md:mt-0.5 md:h-4 md:w-4 md:rounded-sm md:border',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5 md:h-3 md:w-3" strokeWidth={3} />}
                </span>
                <Icon className="mt-0.5 hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
                <span className="min-w-0 flex-1">
                  <span className="text-ios-subhead block md:text-sm md:leading-snug">{label}</span>
                  {detail && (
                    <span className="text-ios-footnote mt-0.5 block text-muted-foreground md:mt-0 md:text-xs md:leading-snug">
                      {detail}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-end border-t p-3 md:p-2">
        <Button
          size="sm"
          onClick={onRun}
          disabled={applying || count === 0}
          loading={applying}
          className="h-11 w-full rounded-[12px] text-[16px] md:h-7 md:w-auto md:rounded-md md:text-xs"
        >
          {applying
            ? 'Saving'
            : count === actions.length
              ? 'Save'
              : `Save ${count} of ${actions.length}`}
        </Button>
      </div>
    </div>
  )
}

/** The people an answer found, as rows. */
export function MatchList({
  matches,
  onOpen,
}: {
  matches: { contact: Contact; reason: string }[]
  onOpen: (contact: Contact) => void
}) {
  return (
    // No card of its own: this sits inside the answer's card, under the prose.
    <div className="border-t">
      <div className="text-ios-footnote px-4 pb-1 pt-2.5 uppercase tracking-[0.04em] text-muted-foreground">
        {matches.length} {matches.length === 1 ? 'person' : 'people'}
      </div>
      <ul>
        {matches.map(({ contact, reason }) => (
          <MatchRow key={contact.id} contact={contact} reason={reason} onOpen={() => onOpen(contact)} />
        ))}
      </ul>
    </div>
  )
}

function MatchRow({
  contact,
  reason,
  onOpen,
}: {
  contact: Contact
  reason: string
  onOpen: () => void
}) {
  const [caughtUp, setCaughtUp] = React.useState(false)

  async function catchUp() {
    setCaughtUp(true)
    try {
      await markCaughtUp(contact)
    } catch {
      setCaughtUp(false)
    }
  }

  return (
    <li className="group flex items-stretch gap-3 pl-4 last:[&>span]:border-b-0 md:hover:bg-accent/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left focus-visible:outline-none"
      >
        <ContactAvatar contact={contact} className="h-9 w-9 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="text-ios-body flex items-center gap-1 md:text-[15px]">
            <span className="truncate">{fullName(contact)}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          </span>
          <span className="text-ios-footnote block line-clamp-2 text-muted-foreground">
            {reason ||
              [contact.jobTitle, contact.company].filter(Boolean).join(' · ') ||
              'In your contacts'}
          </span>
        </span>
      </button>

      <span className="hairline-b flex items-center pr-2">
        <button
          type="button"
          disabled={caughtUp}
          aria-label={`Mark caught up with ${fullName(contact)}`}
          onClick={() => void catchUp()}
          className={cn(
            'press flex h-11 w-11 items-center justify-center rounded-full',
            caughtUp ? 'text-success' : 'text-muted-foreground/70',
          )}
        >
          <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </button>
      </span>
    </li>
  )
}
