import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Loader2,
  NotebookPen,
  RotateCcw,
  Send,
  Sparkles,
  Tag as TagIcon,
  TriangleAlert,
  UserPlus,
  Clock,
  KanbanSquare,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts, useTagMap, useTags } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { askNetwork, startSession } from '@/lib/ai/network'
import type { NetworkAnswer, NetworkSession } from '@/lib/ai/network'
import {
  applyActions,
  describeAction,
  type ActionOutcome,
  type AssistantAction,
} from '@/lib/ai/actions'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { markCaughtUp } from '@/lib/caughtUp'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Carried over from the ⌘K palette or a dashboard box, so it isn't retyped. */
  initialQuestion?: string
}

/**
 * Openers, in the order they teach the feature. Telling comes first: asking is
 * the thing people already expect a search box to do, and recording is the
 * thing they don't know they can say out loud.
 */
const SUGGESTIONS = [
  'Met Priya at the AI meetup — PM at Klaviyo',
  'Coffee with Sarah next Tuesday at 3',
  'I spoke to Marcus today',
  'Who do I know in fintech?',
  'Who should I reconnect with this week?',
]

/** One message and everything that came back for it. */
interface Turn {
  question: string
  answer: NetworkAnswer | null
  /** True when the answer came from Fuse because the model was unavailable. */
  fellBack: boolean
  /** Per-action approval, index-aligned with `answer.actions`. */
  chosen: boolean[]
  applying?: boolean
  /** Set once the plan has been run — the turn becomes a receipt. */
  outcomes?: ActionOutcome[]
}

/**
 * One box for the whole app: ask it about your network, or tell it what to
 * record.
 *
 * Asking was the original job — describe someone you can't name and get them
 * back. Telling is the new half: "met Priya at the AI meetup, coffee Tuesday
 * at 3" comes back as a *plan* — add this contact, schedule that meeting —
 * which sits on screen, itemised and unchecked-able, until the user taps Do
 * it. The model proposes; the person decides; only then does anything get
 * written. Nothing in a plan deletes anything.
 *
 * If the model is unreachable this quietly becomes the fuzzy search it was
 * built on top of — a worse answer, but never no answer.
 */
export function AssistantDialog({ open, onOpenChange, initialQuestion }: Props) {
  const navigate = useNavigate()
  const loaded = useContacts()
  // Stable identity: the roster and the Fuse index both key off this.
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const tags = useTags() ?? []
  const tagMap = useTagMap()
  const isMobile = useIsMobile()

  const [question, setQuestion] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [turns, setTurns] = React.useState<Turn[]>([])
  const session = React.useRef<NetworkSession | null>(null)
  const threadEnd = React.useRef<HTMLDivElement>(null)
  /** A message handed over from ⌘K or the dashboard, to run once. */
  const autoAsk = React.useRef<string | null>(null)

  const reset = React.useCallback(() => {
    session.current = null
    setTurns([])
    setQuestion('')
  }, [])

  React.useEffect(() => {
    if (!open) return
    session.current = null
    setTurns([])
    setQuestion(initialQuestion ?? '')
    // Someone who typed it elsewhere shouldn't have to press Send again.
    autoAsk.current = initialQuestion?.trim() ? initialQuestion : null
  }, [open, initialQuestion])

  // Follow-ups land at the bottom of the thread; keep them in view.
  React.useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end' })
  }, [turns, busy])

  const fuse = React.useMemo(
    () => buildSearchIndex(contacts, tagMap),
    [contacts, tagMap],
  )

  /** The non-AI path, used on its own merits and as the failure path. */
  const keywordFallback = React.useCallback(
    (q: string): Turn => {
      const found = searchContacts(fuse, q).slice(0, 8)
      return {
        question: q,
        fellBack: true,
        chosen: [],
        answer: {
          answer: found.length
            ? 'Keyword matches from your contacts.'
            : 'No keyword matches either — try a company or a tag.',
          matches: found.map((contact) => ({ contact, reason: '' })),
          followUps: [],
          actions: [],
        },
      }
    },
    [fuse],
  )

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setQuestion('')
    try {
      const current = session.current ?? startSession()
      const { answer, session: next } = await askNetwork(
        current,
        trimmed,
        contacts,
        tagMap,
      )
      session.current = next
      setTurns((t) => [
        ...t,
        {
          question: trimmed,
          answer,
          fellBack: false,
          // Everything proposed starts approved; the work is unchecking.
          chosen: answer.actions.map(() => true),
        },
      ])
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        toast.info('AI isn’t set up here — showing keyword matches.')
      } else {
        console.error(err)
        toast.error('Couldn’t do that — showing keyword matches instead.')
      }
      // A thread the model never saw can't be followed up on.
      session.current = null
      setTurns((t) => [...t, keywordFallback(trimmed)])
    } finally {
      setBusy(false)
    }
  }

  // A message handed over from elsewhere runs itself — but only once the
  // contacts have loaded, since there's no roster to ask against before then.
  const askRef = React.useRef(ask)
  askRef.current = ask
  React.useEffect(() => {
    const pending = autoAsk.current
    if (!open || !pending || contacts.length === 0) return
    autoAsk.current = null
    void askRef.current(pending)
  }, [open, contacts.length])

  function patchTurn(index: number, patch: Partial<Turn>) {
    setTurns((t) => t.map((turn, i) => (i === index ? { ...turn, ...patch } : turn)))
  }

  function toggleAction(turnIndex: number, actionIndex: number) {
    setTurns((t) =>
      t.map((turn, i) =>
        i === turnIndex
          ? {
              ...turn,
              chosen: turn.chosen.map((on, j) => (j === actionIndex ? !on : on)),
            }
          : turn,
      ),
    )
  }

  /** Run the approved half of one turn's plan. This is the only writing path. */
  async function runPlan(turnIndex: number) {
    const turn = turns[turnIndex]
    const plan = (turn.answer?.actions ?? []).filter((_, i) => turn.chosen[i])
    if (!plan.length) return

    patchTurn(turnIndex, { applying: true })
    const outcomes = await applyActions(plan, { contacts, tags })
    patchTurn(turnIndex, { applying: false, outcomes })

    const done = outcomes.filter((o) => o.status === 'done').length
    const missed = outcomes.length - done
    if (done) {
      toast.success(`${done} ${done === 1 ? 'thing' : 'things'} saved`, {
        description: missed ? `${missed} needed a human — see the list.` : undefined,
      })
    } else {
      toast.error('Nothing was saved — see the reasons in the list.')
    }

    // The roster the thread is holding predates whatever this just created,
    // so the next message rebuilds it rather than answering from a stale one.
    session.current = null
  }

  function openContact(contact: Contact) {
    onOpenChange(false)
    navigate(ROUTES.contact(contact.id))
  }

  function go(route: string) {
    onOpenChange(false)
    navigate(route)
  }

  const canAsk = contacts.length > 0
  const started = turns.length > 0 || busy
  const last = turns[turns.length - 1]
  const followUps = !busy && !last?.fellBack ? (last?.answer?.followUps ?? []) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mobile: as tall as the sheet is allowed to be, with the composer
          pinned to the bottom — this is the app's primary surface on a phone,
          not a popup. Desktop keeps the centred dialog. */}
      <DialogContent className="flex h-[88dvh] flex-col gap-3 overflow-hidden sm:h-auto sm:max-h-[85vh] sm:max-w-xl sm:overflow-y-auto">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Sparkles className="h-4.5 w-4.5 shrink-0 text-indigo-500" />
            Assistant
            {started && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="ml-auto gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Start over</span>
              </Button>
            )}
          </DialogTitle>
          <DialogDescription className="text-left">
            Ask about your network, or say what happened — you approve anything
            it wants to save.
            <span className="hidden sm:inline">
              {' '}
              “Met Dana at the career fair, she's a recruiter at Wayfair, coffee
              Thursday at 4.”
            </span>
          </DialogDescription>
        </DialogHeader>

        {!canAsk && (
          <p className="text-sm text-muted-foreground">
            Add a few people first — there's nothing to work with yet.
          </p>
        )}

        {canAsk && !started && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {started && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto scrollbar-thin pr-1 sm:max-h-[46vh]">
            {turns.map((turn, i) => (
              <TurnBlock
                key={i}
                turn={turn}
                onOpenContact={openContact}
                onToggleAction={(actionIndex) => toggleAction(i, actionIndex)}
                onRun={() => void runPlan(i)}
                onGo={go}
              />
            ))}
            {busy && (
              <p className="py-3 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                {turns.length === 0
                  ? `Reading through ${contacts.length} ${contacts.length === 1 ? 'person' : 'people'}…`
                  : 'Thinking…'}
              </p>
            )}
            <div ref={threadEnd} />
          </div>
        )}

        {followUps.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => void ask(f)}
                className="rounded-full border border-indigo-500/30 bg-indigo-500/[0.06] px-2.5 py-1 text-xs text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void ask(question)
          }}
          className="flex shrink-0 gap-2"
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={started ? 'Ask or tell it something else…' : 'Ask, or say what happened…'}
            className="h-11 text-base sm:h-9 sm:text-sm"
            autoFocus={!isMobile}
            disabled={!canAsk}
          />
          <Button
            type="submit"
            disabled={!question.trim() || busy || !canAsk}
            className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-auto sm:px-4"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Send</span>
          </Button>
        </form>

        {started && !last?.fellBack && isAiAvailable() && (
          <p className="shrink-0 text-[11px] text-muted-foreground">
            Answers come from what you've written down about these people —
            check anything that matters before you act on it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TurnBlock({
  turn,
  onOpenContact,
  onToggleAction,
  onRun,
  onGo,
}: {
  turn: Turn
  onOpenContact: (contact: Contact) => void
  onToggleAction: (index: number) => void
  onRun: () => void
  onGo: (route: string) => void
}) {
  const { question, answer, fellBack } = turn
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{question}</p>
      {answer?.answer && (
        <p className="text-sm text-muted-foreground">
          {fellBack && <span className="font-medium">Keyword search: </span>}
          {answer.answer}
        </p>
      )}
      {answer &&
        answer.matches.length === 0 &&
        answer.actions.length === 0 &&
        !answer.answer && (
          <p className="text-sm text-muted-foreground">
            Nobody in your contacts fits that.
          </p>
        )}

      {answer && answer.actions.length > 0 && (
        <ActionPlan
          actions={answer.actions}
          chosen={turn.chosen}
          applying={Boolean(turn.applying)}
          outcomes={turn.outcomes}
          onToggle={onToggleAction}
          onRun={onRun}
          onGo={onGo}
        />
      )}

      <div className="space-y-2">
        {answer?.matches.map(({ contact, reason }) => (
          <MatchRow
            key={contact.id}
            contact={contact}
            reason={reason}
            onOpen={() => onOpenContact(contact)}
          />
        ))}
      </div>
    </div>
  )
}

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
 * skipped and why, and where each result lives.
 */
function ActionPlan({
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
    return (
      <div className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
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
    )
  }

  const count = chosen.filter(Boolean).length
  return (
    <div className="space-y-2 rounded-lg border border-indigo-500/30 bg-indigo-500/[0.05] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
        About to save
      </p>
      <div className="space-y-1">
        {actions.map((action, i) => {
          const { label, detail } = describeAction(action)
          const Icon = ACTION_ICON[action.type]
          const on = chosen[i]
          return (
            <button
              key={i}
              type="button"
              disabled={applying}
              onClick={() => onToggle(i)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors',
                on ? 'bg-background/70' : 'opacity-50',
                !applying && 'hover:bg-background',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
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
      <Button
        size="sm"
        onClick={onRun}
        disabled={applying || count === 0}
        className="w-full gap-2 sm:w-auto"
      >
        {applying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {applying ? 'Saving…' : count === actions.length ? 'Do it' : `Do ${count} of ${actions.length}`}
      </Button>
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
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ContactAvatar contact={contact} className="h-9 w-9 shrink-0 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fullName(contact)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {reason ||
              [contact.jobTitle, contact.company].filter(Boolean).join(' · ') ||
              'In your contacts'}
          </p>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Mark caught up with ${fullName(contact)}`}
        title="Caught up"
        onClick={() => void markCaughtUp(contact)}
      >
        <Check className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${fullName(contact)}`}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
