import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRight,
  Check,
  Coffee,
  KanbanSquare,
  PenLine,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { CoffeeChatPrepDialog } from '@/components/contacts/CoffeeChatPrepDialog'
import { useUI } from '@/context/ui-context'
import {
  buildSnapshot,
  generateBriefing,
  localBriefing,
  pruneBriefing,
  snapshotFingerprint,
} from '@/lib/ai/briefing'
import type { Briefing, BriefingAction, BriefingKind } from '@/lib/ai/briefing'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { markCaughtUp } from '@/lib/caughtUp'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Contact, Opportunity, Tag } from '@/types'

interface Props {
  contacts: Contact[]
  opportunities: Opportunity[]
  events: CalendarEvent[]
  tagMap: Map<string, Tag>
  /**
   * False while any of the three lists is still loading. Briefing on half the
   * data would quietly miss tomorrow's meeting, and the pruning below would
   * then keep that stale answer instead of asking again.
   */
  ready: boolean
}

const KIND_STYLE: Record<
  BriefingKind,
  { icon: typeof Coffee; label: string; className: string }
> = {
  prep: {
    icon: Coffee,
    label: 'Prep',
    className: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300',
  },
  reconnect: {
    icon: AlarmClock,
    label: 'Reconnect',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  draft: {
    icon: PenLine,
    label: 'Write',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  pipeline: {
    icon: KanbanSquare,
    label: 'Pipeline',
    className: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  },
}

const ASK_SUGGESTIONS = [
  'Who should I reconnect with this week?',
  'Who do I know in fintech?',
  'Who could refer me for an internship?',
]

/**
 * The dashboard's AI section: today's short list.
 *
 * Everything here already exists elsewhere in the app — overdue contacts,
 * the next few meetings, deadlines on the board. What this adds is an order
 * and a reason, so the page answers "what should I do now?" instead of
 * "here is everything". The same card carries the ask box, because the other
 * half of "what now?" is "who do I know who…".
 *
 * With AI unconfigured or unreachable the list is still there, written by the
 * rules in `localBriefing` — the card never becomes an error message.
 */
export function BriefingCard({
  contacts,
  opportunities,
  events,
  tagMap,
  ready,
}: Props) {
  const navigate = useNavigate()
  const { openAssistant } = useUI()

  const snapshot = React.useMemo(
    () => buildSnapshot(contacts, opportunities, events),
    [contacts, opportunities, events],
  )
  // The snapshot object is new on every data change, but the *facts* in it
  // often aren't — the fingerprint is what decides whether to spend a request.
  const fingerprint = React.useMemo(() => snapshotFingerprint(snapshot), [snapshot])

  // Read inside the async call only, so a fresh Map each render can't
  // re-trigger the effect.
  const latest = React.useRef({ snapshot, tagMap })
  latest.current = { snapshot, tagMap }

  const [briefing, setBriefing] = React.useState<Briefing | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [prepContactId, setPrepContactId] = React.useState<string | undefined>()
  const [question, setQuestion] = React.useState('')

  /** The state of the world the current briefing was written for. */
  const generatedFor = React.useRef<string | null>(null)
  const current = React.useRef<Briefing | null>(null)
  current.current = briefing

  const run = React.useCallback(
    async (force: boolean, signal?: AbortSignal) => {
      const { snapshot: snap, tagMap: tags } = latest.current
      generatedFor.current = snapshotFingerprint(snap)
      setLoading(true)
      try {
        const result = await generateBriefing(snap, tags, { force, signal })
        if (!signal?.aborted) setBriefing(result)
      } catch (err) {
        if (signal?.aborted) return
        if (!(err instanceof AiUnavailableError)) console.error(err)
        setBriefing(localBriefing(snap))
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    if (!ready || generatedFor.current === fingerprint) return

    // Acting on the briefing changes the data underneath it — tap "caught up"
    // and that person stops being overdue. Rewriting the rules-based list is
    // free; a model-written one is pruned instead, so a tap doesn't cost a
    // request. Only an empty list is worth asking again for.
    const previous = current.current
    if (previous) {
      generatedFor.current = fingerprint
      if (!previous.fromModel) {
        setBriefing(localBriefing(latest.current.snapshot))
        return
      }
      const pruned = pruneBriefing(previous, latest.current.snapshot)
      if (pruned.actions.length > 0) {
        setBriefing(pruned)
        return
      }
    }

    const controller = new AbortController()
    void run(false, controller.signal)
    return () => controller.abort()
  }, [fingerprint, ready, run])

  function openAction(action: BriefingAction) {
    if (action.opportunity) navigate(ROUTES.pipeline)
    else if (action.contact) navigate(ROUTES.contact(action.contact.id))
    else if (action.event) navigate(ROUTES.calendar)
  }

  const empty = snapshot.empty

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-b from-indigo-500/[0.05] to-transparent">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h2 className="font-semibold">Your briefing</h2>
            {briefing && !briefing.fromModel && !empty && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                {isAiAvailable() ? 'from your data' : 'AI off'}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void run(true)}
            disabled={!ready || loading || empty}
            aria-label="Rebuild briefing"
            title="Rebuild briefing"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>

        {(!ready || loading) && !briefing ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : empty ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nothing is overdue and nothing is scheduled — a good place to be.
            Add people as you meet them and this fills itself in.
          </p>
        ) : (
          <>
            {briefing?.headline && (
              <p className="mb-3 text-sm text-muted-foreground">{briefing.headline}</p>
            )}
            <ul className="space-y-1.5">
              {briefing?.actions.map((action, i) => (
                <ActionRow
                  key={`${action.kind}-${action.contact?.id ?? action.opportunity?.id ?? i}`}
                  action={action}
                  onOpen={() => openAction(action)}
                  onPrep={
                    action.contact
                      ? () => setPrepContactId(action.contact?.id)
                      : undefined
                  }
                />
              ))}
            </ul>
          </>
        )}

        {/* The other half of "what now?": who do I know who… */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const q = question.trim()
            if (!q) return
            openAssistant(q)
            setQuestion('')
          }}
          className="mt-4 hidden gap-2 border-t pt-4 md:flex"
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask, or say what happened…"
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={!question.trim()}>
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>
        <div className="mt-2 hidden flex-wrap gap-1.5 md:flex">
          {ASK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => openAssistant(s)}
              className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </CardContent>

      <CoffeeChatPrepDialog
        open={Boolean(prepContactId)}
        onOpenChange={(open) => !open && setPrepContactId(undefined)}
        contactId={prepContactId}
      />
    </Card>
  )
}

function ActionRow({
  action,
  onOpen,
  onPrep,
}: {
  action: BriefingAction
  onOpen: () => void
  onPrep?: () => void
}) {
  const style = KIND_STYLE[action.kind]
  const Icon = style.icon
  const contact = action.contact

  return (
    <li className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/60">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {contact ? (
          <ContactAvatar contact={contact} className="h-9 w-9 shrink-0 text-xs" />
        ) : (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              style.className,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{action.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span
              className={cn(
                'mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium',
                style.className,
              )}
            >
              {style.label}
            </span>
            {action.why}
          </p>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {onPrep && (action.kind === 'prep' || action.kind === 'draft') && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={onPrep}>
            Prep
          </Button>
        )}
        {contact && action.kind === 'reconnect' && (
          <Button
            variant="ghost"
            size="icon-sm"
            title={`Caught up with ${fullName(contact)}`}
            aria-label={`Mark caught up with ${fullName(contact)}`}
            onClick={() => void markCaughtUp(contact)}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </li>
  )
}

/** Shown while the dashboard itself is still loading its data. */
export function BriefingSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-2/3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}
