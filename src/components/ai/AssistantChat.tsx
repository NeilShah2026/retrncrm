import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowUp,
  Check,
  Copy,
  Mic,
  NotebookPen,
  Search,
  Sparkles,
} from 'lucide-react'
import { useAssistant, type AssistantTurn } from '@/context/assistant-context'
import { useUI } from '@/context/ui-context'
import { useContacts, useTagMap, useTags } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { askNetwork, startSession } from '@/lib/ai/network'
import { applyActions } from '@/lib/ai/actions'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { renderMarkdown } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { ActionPlan, MatchList } from './AssistantBlocks'
import type { Contact } from '@/types'

/**
 * The assistant, as a full conversation.
 *
 * This used to be a dialog, which meant the thread was a guest on top of the
 * app: capped height, a scroll region inside a scroll region, and nowhere for
 * an answer to breathe. As a screen it can do what a chat is supposed to do —
 * one column, messages that render their own embedded UI (a plan you approve,
 * the people it found), and a composer that stays where your thumb left it.
 *
 * Asking and telling share the one box on purpose. "Who do I know in fintech?"
 * and "met Priya at the AI meetup, coffee Tuesday at 3" are the same gesture to
 * the person typing; only the reply differs — matches for one, a plan for the
 * other. The model proposes; the person approves; only then is anything
 * written. If the model is unreachable this quietly becomes the fuzzy search it
 * was built on top of — a worse answer, but never no answer.
 */

/** Openers, grouped so the two halves of the feature are both discoverable. */
const SUGGESTION_GROUPS = [
  {
    label: 'Ask about your network',
    icon: Search,
    items: [
      'Who do I know in fintech?',
      'Who should I reconnect with this week?',
      'Who could introduce me to a recruiter?',
    ],
  },
  {
    label: 'Record what happened',
    icon: NotebookPen,
    items: [
      'Met Priya at the AI meetup — PM at Klaviyo',
      'Coffee with Sarah next Tuesday at 3',
      'I spoke to Marcus today',
    ],
  },
]

/** What the composer offers when it is empty, one at a time. */
const PLACEHOLDERS = [
  'Ask about your network, or say what happened…',
  'Met Priya at the AI meetup — PM at Klaviyo',
  'Who should I reconnect with this week?',
]

let turnSeq = 0
function nextTurnId(): string {
  turnSeq += 1
  return `turn-${turnSeq}`
}

export function AssistantChat() {
  const navigate = useNavigate()
  const { openVoiceCapture } = useUI()
  const isMobile = useIsMobile()

  const loaded = useContacts()
  // Stable identity: the roster and the Fuse index both key off this.
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const tags = useTags() ?? []
  const tagMap = useTagMap()

  const {
    turns,
    setTurns,
    busy,
    setBusy,
    draft,
    setDraft,
    session,
    epoch,
    pending,
    handoff,
  } = useAssistant()

  const threadEnd = React.useRef<HTMLDivElement>(null)

  // Follow-ups land at the bottom of the thread; keep them in view. `auto`
  // rather than `smooth` on the first paint so returning to a thread you
  // already had doesn't animate through the whole history.
  const firstPaint = React.useRef(true)
  React.useEffect(() => {
    threadEnd.current?.scrollIntoView({
      block: 'end',
      behavior: firstPaint.current ? 'auto' : 'smooth',
    })
    firstPaint.current = false
  }, [turns, busy])

  const fuse = React.useMemo(
    () => buildSearchIndex(contacts, tagMap),
    [contacts, tagMap],
  )

  /** The non-AI path, used on its own merits and as the failure path. */
  const keywordFallback = React.useCallback(
    (q: string): AssistantTurn => {
      const found = searchContacts(fuse, q).slice(0, 8)
      return {
        id: nextTurnId(),
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

  const ask = React.useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed || busy) return
      // If "New chat" is pressed while this is in flight, the answer belongs to
      // a thread that no longer exists — drop it rather than resurrecting it.
      const startedAt = epoch.current
      setBusy(true)
      setDraft('')
      try {
        const current = session.current ?? startSession()
        const { answer, session: next } = await askNetwork(
          current,
          trimmed,
          contacts,
          tagMap,
        )
        if (epoch.current !== startedAt) return
        session.current = next
        setTurns((t) => [
          ...t,
          {
            id: nextTurnId(),
            question: trimmed,
            answer,
            fellBack: false,
            // Everything proposed starts approved; the work is unchecking.
            chosen: answer.actions.map(() => true),
          },
        ])
      } catch (err) {
        if (epoch.current !== startedAt) return
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
        if (epoch.current === startedAt) setBusy(false)
      }
    },
    [
      busy,
      contacts,
      tagMap,
      keywordFallback,
      session,
      epoch,
      setBusy,
      setDraft,
      setTurns,
    ],
  )

  // A message handed over from ⌘K, the dashboard, or the nav runs itself — but
  // only once the contacts have loaded, since there's no roster to ask against
  // before then. `handoff` is in the deps so a second handover of the *same*
  // text still fires.
  const askRef = React.useRef(ask)
  askRef.current = ask
  React.useEffect(() => {
    const queued = pending.current
    if (!queued || contacts.length === 0) return
    pending.current = null
    void askRef.current(queued)
  }, [handoff, contacts.length, pending])

  function patchTurn(id: string, patch: Partial<AssistantTurn>) {
    setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)))
  }

  function toggleAction(id: string, actionIndex: number) {
    setTurns((t) =>
      t.map((turn) =>
        turn.id === id
          ? {
              ...turn,
              chosen: turn.chosen.map((on, j) => (j === actionIndex ? !on : on)),
            }
          : turn,
      ),
    )
  }

  /** Run the approved half of one turn's plan. This is the only writing path. */
  async function runPlan(turn: AssistantTurn) {
    const plan = (turn.answer?.actions ?? []).filter((_, i) => turn.chosen[i])
    if (!plan.length) return

    patchTurn(turn.id, { applying: true })
    const outcomes = await applyActions(plan, { contacts, tags })
    patchTurn(turn.id, { applying: false, outcomes })

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

  const canAsk = contacts.length > 0
  const started = turns.length > 0 || busy
  const last = turns[turns.length - 1]
  const followUps = !busy && !last?.fellBack ? (last?.answer?.followUps ?? []) : []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4 md:px-6">
          {!started ? (
            <EmptyState
              canAsk={canAsk}
              contactCount={contacts.length}
              onPick={(s) => void ask(s)}
            />
          ) : (
            <div className="space-y-7">
              {turns.map((turn) => (
                <TurnBlock
                  key={turn.id}
                  turn={turn}
                  onOpenContact={(c) => navigate(ROUTES.contact(c.id))}
                  onToggleAction={(i) => toggleAction(turn.id, i)}
                  onRun={() => void runPlan(turn)}
                  onGo={(route) => navigate(route)}
                />
              ))}
              {busy && <Thinking contactCount={contacts.length} first={turns.length === 0} />}
            </div>
          )}
          <div ref={threadEnd} />
        </div>
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={() => void ask(draft)}
        onVoice={openVoiceCapture}
        busy={busy}
        disabled={!canAsk}
        started={started}
        followUps={followUps}
        onFollowUp={(f) => void ask(f)}
        sendOnEnter={!isMobile}
        showDisclaimer={started && !last?.fellBack && isAiAvailable()}
      />
    </div>
  )
}

/**
 * The opening screen. Two columns of openers rather than one list, because
 * the two things this box does — answering and recording — look nothing alike
 * and nobody guesses the second one on their own.
 */
function EmptyState({
  canAsk,
  contactCount,
  onPick,
}: {
  canAsk: boolean
  contactCount: number
  onPick: (s: string) => void
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-16">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="mt-4 font-serif text-2xl font-medium tracking-tight sm:text-3xl">
        What can I help you with?
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {canAsk
          ? `Ask about the ${contactCount} ${contactCount === 1 ? 'person' : 'people'} you've saved, or just say what happened — you approve anything before it's saved.`
          : 'Add a few people first — there’s nothing to work with yet.'}
      </p>

      {canAsk && (
        <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
          {SUGGESTION_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
              </div>
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPick(item)}
                  className="block w-full rounded-xl border bg-card/50 px-3.5 py-2.5 text-left text-sm leading-snug transition-colors hover:border-indigo-500/40 hover:bg-accent"
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** One exchange: what you said, then everything that came back for it. */
function TurnBlock({
  turn,
  onOpenContact,
  onToggleAction,
  onRun,
  onGo,
}: {
  turn: AssistantTurn
  onOpenContact: (contact: Contact) => void
  onToggleAction: (index: number) => void
  onRun: () => void
  onGo: (route: string) => void
}) {
  const { question, answer, fellBack } = turn
  const empty =
    answer &&
    !answer.answer &&
    answer.matches.length === 0 &&
    answer.actions.length === 0

  return (
    <div className="space-y-4">
      {/* You. Right-aligned and bubbled — the one thing in the thread that is
          quoting the person rather than answering them. */}
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[15px] leading-relaxed">
          {question}
        </p>
      </div>

      {/* The assistant. Full width, no bubble — a bubble around a block of
          embedded UI reads as a quote rather than as the app talking. */}
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {fellBack && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
              Keyword search
            </p>
          )}

          {answer?.answer && <AnswerProse text={answer.answer} />}

          {empty && (
            <p className="text-[15px] text-muted-foreground">
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

          {answer && answer.matches.length > 0 && (
            <MatchList matches={answer.matches} onOpen={onOpenContact} />
          )}
        </div>
      </div>
    </div>
  )
}

/** The prose half of an answer, with a copy affordance on hover. */
function AnswerProse({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const html = React.useMemo(() => renderMarkdown(text), [text])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Couldn’t copy that.')
    }
  }

  return (
    <div className="group/prose">
      <div
        className="prose-chat"
        // Sanitized in renderMarkdown (marked → DOMPurify).
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Under the message rather than floating over its first line, which is
          where a hover-revealed button ends up covering the text it belongs to. */}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy this answer"
        className="mt-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/prose:opacity-100"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>
    </div>
  )
}

/** What the model is doing, said in stages so a slow answer still reads as progress. */
function Thinking({ contactCount, first }: { contactCount: number; first: boolean }) {
  const stages = React.useMemo(
    () =>
      first
        ? [
            `Reading through ${contactCount} ${contactCount === 1 ? 'person' : 'people'}…`,
            'Working out what you meant…',
            'Putting an answer together…',
          ]
        : ['Thinking…', 'Checking your contacts…', 'Almost there…'],
    [contactCount, first],
  )
  const [stage, setStage] = React.useState(0)

  React.useEffect(() => {
    setStage(0)
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, stages.length - 1)),
      2600,
    )
    return () => clearInterval(timer)
  }, [stages])

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
      </div>
      <p className="shimmer pt-0.5 text-[15px]" aria-live="polite">
        {stages[stage]}
      </p>
    </div>
  )
}

/**
 * The composer, pinned to the bottom of the screen.
 *
 * A textarea rather than an input: this box takes whole sentences about people
 * you just met, and a single-line field that scrolls sideways makes you lose
 * the start of your own thought.
 */
function Composer({
  value,
  onChange,
  onSubmit,
  onVoice,
  busy,
  disabled,
  started,
  followUps,
  onFollowUp,
  sendOnEnter,
  showDisclaimer,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onVoice: () => void
  busy: boolean
  disabled: boolean
  started: boolean
  followUps: string[]
  onFollowUp: (f: string) => void
  sendOnEnter: boolean
  showDisclaimer: boolean
}) {
  const box = React.useRef<HTMLTextAreaElement>(null)
  const [placeholder, setPlaceholder] = React.useState(0)

  // Cycling the placeholder is how someone learns this box takes instructions
  // and not just questions — one static hint only ever teaches one of them.
  React.useEffect(() => {
    if (value || started) return
    const timer = setInterval(
      () => setPlaceholder((i) => (i + 1) % PLACEHOLDERS.length),
      4000,
    )
    return () => clearInterval(timer)
  }, [value, started])

  // Grow with the content, up to a ceiling — past that the box scrolls rather
  // than eating the conversation above it.
  React.useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const canSend = Boolean(value.trim()) && !busy && !disabled

  return (
    <div className="shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-2">
      <div className="mx-auto w-full max-w-3xl px-4 pb-3 md:px-6 md:pb-4">
        {followUps.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFollowUp(f)}
                className="rounded-full border border-indigo-500/30 bg-indigo-500/[0.06] px-3 py-1.5 text-xs text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSend) onSubmit()
          }}
          className={cn(
            'rounded-2xl border bg-card shadow-sm transition-colors',
            'focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/15',
          )}
        >
          <textarea
            ref={box}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on a keyboard; on a phone it has to insert a
              // newline, since there is no shift to hold.
              if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) {
                e.preventDefault()
                if (canSend) onSubmit()
              }
            }}
            placeholder={
              disabled
                ? 'Add a few people first…'
                : started
                  ? 'Ask or tell it something else…'
                  : PLACEHOLDERS[placeholder]
            }
            aria-label="Ask the assistant, or tell it what happened"
            disabled={disabled}
            className="max-h-[200px] w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <button
              type="button"
              onClick={onVoice}
              aria-label="Say who you met"
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Say it instead</span>
            </button>

            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                canSend
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>

        <p className="mt-2 h-4 text-center text-[11px] text-muted-foreground">
          {showDisclaimer
            ? 'Answers come from what you’ve written down — check anything that matters.'
            : ''}
        </p>
      </div>
    </div>
  )
}
