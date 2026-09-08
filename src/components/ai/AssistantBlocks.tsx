import * as React from 'react'
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  KanbanSquare,
  Loader2,
  NotebookPen,
  Tag as TagIcon,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { markCaughtUp } from '@/lib/caughtUp'
import { describeAction, type ActionOutcome, type AssistantAction } from '@/lib/ai/actions'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

/**
 * The things the assistant can put *inside* a message.
 *
 * A chat that could only reply in prose would have to describe a person and
 * then make you go find them. These blocks are the answer itself — a plan you
 * can edit and run, a person you can open or catch up with, a receipt for what
 * was saved — so the thread is somewhere work happens rather than somewhere
 * work gets described.
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

/**
 * The plan, before it happens.
 *
 * Every line says what it will do in the user's own terms and can be switched
 * off. Once run, the same block becomes the receipt — what was saved, what was
 * skipped and why, and where each result lives. Nothing here deletes anything.
 */
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
      <div className="overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04]">
        <div className="flex items-center gap-2 border-b border-emerald-500/20 px-3.5 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {saved === outcomes.length
              ? saved === 1
                ? 'Saved it'
                : `Saved all ${saved}`
              : `Saved ${saved} of ${outcomes.length}`}
          </span>
        </div>
        <div className="space-y-1.5 p-3">
          {outcomes.map((outcome, i) => {
            const ok = outcome.status === 'done'
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn(!ok && 'text-muted-foreground')}>
                    {outcome.message}
                  </span>
                  {outcome.route && ok && (
                    <button
                      type="button"
                      onClick={() => onGo(outcome.route!)}
                      className="ml-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Open
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const count = chosen.filter(Boolean).length
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-500/[0.04]">
      <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 px-3.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          About to save
        </span>
        <span className="text-[11px] text-muted-foreground">
          {count} of {actions.length} selected
        </span>
      </div>

      <div className="space-y-1 p-2">
        {actions.map((action, i) => {
          const { label, detail } = describeAction(action)
          const Icon = ACTION_ICON[action.type]
          const on = chosen[i]
          return (
            <button
              key={i}
              type="button"
              disabled={applying}
              aria-pressed={on}
              onClick={() => onToggle(i)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors',
                on ? 'bg-background/70' : 'opacity-45',
                !applying && 'hover:bg-background',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  on
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-muted-foreground/40',
                )}
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">{label}</span>
                {detail && (
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {detail}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="border-t border-indigo-500/20 p-2">
        <Button
          size="sm"
          onClick={onRun}
          disabled={applying || count === 0}
          className="w-full gap-2"
        >
          {applying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {applying
            ? 'Saving…'
            : count === actions.length
              ? 'Do it'
              : `Do ${count} of ${actions.length}`}
        </Button>
      </div>
    </div>
  )
}

/**
 * The people an answer found, as an embedded block rather than a paragraph
 * naming them.
 */
export function MatchList({
  matches,
  onOpen,
}: {
  matches: { contact: Contact; reason: string }[]
  onOpen: (contact: Contact) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card/50">
      <div className="flex items-center gap-2 border-b px-3.5 py-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {matches.length} {matches.length === 1 ? 'person' : 'people'}
        </span>
      </div>
      <div className="divide-y">
        {matches.map(({ contact, reason }) => (
          <MatchRow
            key={contact.id}
            contact={contact}
            reason={reason}
            onOpen={() => onOpen(contact)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A match is only useful if you can act on it here — opening the profile, or
 * resetting the reconnect clock when the answer *was* "you already spoke".
 */
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
      // Put the button back so the tap can be retried.
      setCaughtUp(false)
    }
  }

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ContactAvatar contact={contact} className="h-9 w-9 shrink-0 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-medium">
            <span className="truncate">{fullName(contact)}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {reason ||
              [contact.jobTitle, contact.company].filter(Boolean).join(' · ') ||
              'In your contacts'}
          </span>
        </span>
      </button>

      <Button
        variant={caughtUp ? 'ghost' : 'outline'}
        size="sm"
        disabled={caughtUp}
        aria-label={`Mark caught up with ${fullName(contact)}`}
        onClick={() => void catchUp()}
        className={cn(
          'h-7 shrink-0 gap-1 px-2 text-xs',
          caughtUp && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        <Check className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{caughtUp ? 'Logged' : 'Caught up'}</span>
      </Button>
    </div>
  )
}
