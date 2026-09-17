import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowUp,
  ArrowUpRight,
  Building2,
  Check,
  CircleUserRound,
  Clock,
  Copy,
  Mic,
  PenLine,
  Search,
  Tag as TagIcon,
} from 'lucide-react'
import { useAssistant, type AssistantTurn } from '@/context/assistant-context'
import { useUI } from '@/context/ui-context'
import { useContacts, useFollowUps, useKeyDates, useTagMap, useTags } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { getReconnectStatus } from '@/lib/reconnect'
import { askNetwork, startSession } from '@/lib/ai/network'
import { applyActions } from '@/lib/ai/actions'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { fullName, renderMarkdown } from '@/lib/format'
import { dismissKeyboard, dismissKeyboardOnDrag } from '@/lib/keyboard'
import { tapFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { ActionPlan, MatchList } from './AssistantBlocks'
import type { Contact, Tag } from '@/types'

/**
 * The assistant, as a thread. Asking and telling share one box: "Who do I
 * know in fintech?" and "met Priya at the AI meetup" are the same gesture to
 * the person typing; only the reply differs. The model proposes; the person
 * approves; only then is anything written. If the model is unreachable this
 * becomes the fuzzy search it was built on.
 */

/**
 * What to offer before anything has been asked.
 *
 * Built from the roster in front of us, never a canned list: the old one
 * suggested "Met Priya at the AI meetup" to people who have never met a
 * Priya, which reads as a screenshot rather than an assistant. Everything
 * here names someone real, and only appears when it has something to name.
 */
interface Starter {
  icon: typeof Search
  text: string
  detail?: string
}

function useStarters(contacts: Contact[], tags: Tag[]): { ask: Starter[]; record: Starter[] } {
  return React.useMemo(() => {
    const ask: Starter[] = []
    const record: Starter[] = []
    if (contacts.length === 0) return { ask, record }

    const overdue = contacts.filter((c) => getReconnectStatus(c).overdue)
    if (overdue.length > 0) {
      ask.push({
        icon: Clock,
        text: 'Who should I reconnect with?',
        detail: `${overdue.length} ${overdue.length === 1 ? 'person is' : 'people are'} past their catch-up goal`,
      })
    }

    const byCompany = new Map<string, number>()
    for (const c of contacts) {
      if (c.company) byCompany.set(c.company, (byCompany.get(c.company) ?? 0) + 1)
    }
    const topCompany = [...byCompany.entries()].sort((a, b) => b[1] - a[1])[0]
    if (topCompany) {
      ask.push({
        icon: Building2,
        text: `Who do I know at ${topCompany[0]}?`,
        detail: `${topCompany[1]} ${topCompany[1] === 1 ? 'person' : 'people'}`,
      })
    }

    const byTag = tags
      .map((t) => ({ tag: t, n: contacts.filter((c) => c.tagIds.includes(t.id)).length }))
      .sort((a, b) => b.n - a.n)[0]
    if (byTag && byTag.n > 1) {
      ask.push({
        icon: TagIcon,
        text: `Who's tagged ${byTag.tag.name}?`,
        detail: `${byTag.n} people`,
      })
    }

    const newest = [...contacts]
      .filter((c) => c.dateMet)
      .sort((a, b) => (b.dateMet ?? '').localeCompare(a.dateMet ?? ''))[0]
    if (newest) {
      ask.push({
        icon: CircleUserRound,
        text: `What should I ask ${newest.firstName} next time?`,
        detail: [newest.jobTitle, newest.company].filter(Boolean).join(' · ') || undefined,
      })
      record.push({
        icon: PenLine,
        text: `Spoke to ${fullName(newest)} today`,
        detail: 'Logs a catch-up on their timeline',
      })
    }

    const withGoal = contacts.find((c) => c.contactFrequencyGoal !== 'none' && c.id !== newest?.id)
    if (withGoal) {
      record.push({
        icon: PenLine,
        text: `Coffee with ${withGoal.firstName} next Tuesday at 3`,
        detail: 'Schedules it and links them',
      })
    }

    return { ask: ask.slice(0, 4), record: record.slice(0, 2) }
  }, [contacts, tags])
}

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
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const tags = useTags() ?? []
  const tagMap = useTagMap()
  const reminderFollowUps = useFollowUps()
  const reminderKeyDates = useKeyDates()

  const { turns, setTurns, busy, setBusy, draft, setDraft, session, epoch, pending, handoff } =
    useAssistant()

  /*
   * The thread scrolls itself, never via `scrollIntoView`: that scrolls every
   * ancestor that can scroll — including the app shell's `overflow: hidden`
   * columns — and on a phone that is the whole screen shifting up and staying
   * there.
   */
  const thread = React.useRef<HTMLDivElement>(null)
  const atEnd = React.useRef(true)
  /**
   * Only a person scrolling can take the thread off its end. The shell
   * resizing under the keyboard fires scroll events too, read mid-resize,
   * and trusting those unpinned the thread halfway up.
   */
  const touched = React.useRef(false)
  const firstPaint = React.useRef(true)
  React.useEffect(() => {
    const el = thread.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: firstPaint.current ? 'auto' : 'smooth' })
    atEnd.current = true
    firstPaint.current = false
  }, [turns, busy])

  // A thread read from its latest message stays on it while the space above
  // the composer changes — the box growing a line, the keyboard arriving —
  // as Messages does, instead of letting the newest reply slide under.
  React.useEffect(() => {
    const el = thread.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (atEnd.current && el.dataset.keyboardAnchor === 'end') el.scrollTop = el.scrollHeight
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const fuse = React.useMemo(() => buildSearchIndex(contacts, tagMap), [contacts, tagMap])

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
            : 'No keyword matches either. Try a company or a tag.',
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
      const startedAt = epoch.current
      // On a phone the keyboard goes down once something is asked: the reply
      // is a thing to read and approve, and the thread needs the room.
      if (isMobile) dismissKeyboard()
      setBusy(true)
      setDraft('')
      // The question goes up the moment it's asked, answer pending. Waiting
      // for the reply to post both is what made a slow answer look like the
      // message had been swallowed.
      const turnId = nextTurnId()
      setTurns((t) => [
        ...t,
        { id: turnId, question: trimmed, answer: null, fellBack: false, chosen: [] },
      ])
      const settle = (patch: Partial<AssistantTurn>) =>
        setTurns((t) => t.map((turn) => (turn.id === turnId ? { ...turn, ...patch } : turn)))
      try {
        const current = session.current ?? startSession()
        const { answer, session: next } = await askNetwork(current, trimmed, contacts, tagMap, undefined, {
          followUps: reminderFollowUps ?? [],
          keyDates: reminderKeyDates ?? [],
        })
        if (epoch.current !== startedAt) return
        session.current = next
        settle({ answer, fellBack: false, chosen: answer.actions.map(() => true) })
      } catch (err) {
        if (epoch.current !== startedAt) return
        if (err instanceof AiUnavailableError) {
          toast.info('AI isn’t set up here. Showing keyword matches.')
        } else {
          console.error(err)
          // The server's reason, not just the fact of failure: "sign in
          // again" and "the model is down" need different things from you.
          toast.error('Couldn’t do that. Showing keyword matches instead.', {
            description: err instanceof Error ? err.message : undefined,
          })
        }
        session.current = null
        const fallback = keywordFallback(trimmed)
        settle({ answer: fallback.answer, fellBack: true, chosen: [] })
      } finally {
        if (epoch.current === startedAt) setBusy(false)
      }
    },
    [busy, contacts, tagMap, reminderFollowUps, reminderKeyDates, keywordFallback, session, epoch, setBusy, setDraft, setTurns, isMobile],
  )

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
          ? { ...turn, chosen: turn.chosen.map((on, j) => (j === actionIndex ? !on : on)) }
          : turn,
      ),
    )
  }

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
      toast.error('Nothing was saved. See the reasons in the list.')
    }
    session.current = null
  }

  const starters = useStarters(contacts, tags)
  const canAsk = contacts.length > 0
  const started = turns.length > 0 || busy
  const last = turns[turns.length - 1]
  const followUps = !busy && !last?.fellBack ? (last?.answer?.followUps ?? []) : []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={thread}
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
            atEnd.current = true
            touched.current = false
          } else if (touched.current) {
            atEnd.current = false
          }
        }}
        onTouchStart={(e) => {
          touched.current = true
          // Dragging the thread puts the keyboard away, as in Messages.
          if (isMobile) dismissKeyboardOnDrag.onTouchStart(e)
        }}
        onTouchMove={isMobile ? dismissKeyboardOnDrag.onTouchMove : undefined}
        onWheel={() => {
          touched.current = true
        }}
        onPointerDown={() => {
          touched.current = true
        }}
        data-keyboard-anchor={started ? 'end' : undefined}
        className="scroll-native min-h-0 flex-1 overflow-y-auto overscroll-contain bg-grouped scrollbar-thin md:bg-background"
      >
        <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-3 md:px-6">
          {!started ? (
            <Opening
              canAsk={canAsk}
              contactCount={contacts.length}
              starters={starters}
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
              {busy && <Thinking />}
            </div>
          )}
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
 * Before anything is asked: one line about what this is, then a few openers
 * naming people who are actually in the network. With nothing saved yet
 * there's nothing to ask about, and it says so instead of offering openers
 * that would come back empty.
 */
function Opening({
  canAsk,
  contactCount,
  starters,
  onPick,
}: {
  canAsk: boolean
  contactCount: number
  starters: { ask: Starter[]; record: Starter[] }
  onPick: (s: string) => void
}) {
  return (
    <div className="pt-3 sm:pt-10">
      <h1 className="text-ios-title md:text-xl md:font-semibold md:tracking-[-0.02em]">
        {canAsk ? 'Ask about your network' : 'Nothing to ask about yet'}
      </h1>
      {/* Folds away while typing, so the openers below keep the room. */}
      <div className="keyboard-collapse">
        <div>
          <p className="text-ios-subhead mt-1.5 max-w-md text-muted-foreground md:text-sm">
            {canAsk
              ? `Answers come from the ${contactCount} ${contactCount === 1 ? 'person' : 'people'} you've saved. Nothing is written down until you approve it.`
              : 'Save a few people first — this answers from what you have written down, and there is nothing there yet.'}
          </p>
        </div>
      </div>

      {canAsk && (
        <div className="mt-6 space-y-6">
          {starters.ask.length > 0 && (
            <StarterGroup label="Ask" items={starters.ask} onPick={onPick} />
          )}
          {starters.record.length > 0 && (
            <StarterGroup label="Record" items={starters.record} onPick={onPick} />
          )}
        </div>
      )}
    </div>
  )
}

function StarterGroup({
  label,
  items,
  onPick,
}: {
  label: string
  items: Starter[]
  onPick: (s: string) => void
}) {
  return (
    <section>
      <h2 className="text-ios-footnote px-1 pb-1.5 uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </h2>
      <div className="overflow-hidden rounded-[14px] bg-grouped-cell ring-1 ring-inset ring-border/60">
        {items.map((item, i) => (
          <button
            key={item.text}
            type="button"
            onClick={() => {
              tapFeedback()
              onPick(item.text)
            }}
            className="press-row flex w-full items-stretch gap-3 pl-4 text-left md:hover:bg-accent/50"
          >
            <span className="flex shrink-0 items-center py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/[0.06] text-text-secondary">
                <item.icon className="h-[15px] w-[15px]" strokeWidth={2} />
              </span>
            </span>
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 py-3 pr-4',
                i < items.length - 1 && 'hairline-b',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="text-ios-body block md:text-[15px]">{item.text}</span>
                {item.detail && (
                  <span className="text-ios-footnote mt-0.5 block truncate text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/45" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * One exchange. The question is a bubble, as a thing you said; the reply is a
 * card, as a thing the app made — prose, then who it found, then what it
 * wants to write down.
 */
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
  const empty = answer && !answer.answer && answer.matches.length === 0 && answer.actions.length === 0

  return (
    <div className="turn-in space-y-3">
      <div className="flex justify-end">
        <p className="text-ios-body max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[7px] bg-primary px-4 py-2.5 text-primary-foreground md:text-[15px] md:leading-relaxed">
          {question}
        </p>
      </div>

      {/* Still waiting: the question stands alone until there's a reply. */}
      {!answer ? null : (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[16px] bg-grouped-cell ring-1 ring-inset ring-border/60">
          {fellBack && (
            <p className="text-ios-footnote flex items-center gap-1.5 border-b px-4 py-2 text-warning">
              <Search className="h-3.5 w-3.5" />
              Keyword search — the model wasn't available
            </p>
          )}
          {answer?.answer && <AnswerProse text={answer.answer} />}
          {empty && (
            <p className="text-ios-subhead px-4 py-3.5 text-muted-foreground md:text-[15px]">
              Nobody in your contacts fits that.
            </p>
          )}
          {answer && answer.matches.length > 0 && (
            <MatchList matches={answer.matches} onOpen={onOpenContact} />
          )}
        </div>

        {answer.actions.length > 0 && (
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
      </div>
      )}
    </div>
  )
}

/** The prose part of an answer, with a quiet copy affordance under it. */
function AnswerProse({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const html = React.useMemo(() => renderMarkdown(text), [text])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Couldn\u2019t copy that.')
    }
  }

  return (
    <div className="group/prose px-4 pb-2.5 pt-3.5">
      {/* Sanitized in renderMarkdown (marked → DOMPurify). */}
      <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy this answer"
        className="text-ios-footnote -ml-1 mt-1.5 flex items-center gap-1 rounded-sm px-1 py-0.5 text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
    </div>
  )
}

/** Composing: the three dots every messaging app uses for exactly this. */
function Thinking() {
  return (
    <div className="turn-in flex" aria-live="polite">
      <span className="flex h-10 items-center gap-1.5 rounded-[16px] bg-grouped-cell px-4 ring-1 ring-inset ring-border/60">
        <span className="sr-only">Thinking…</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="typing-dot h-2 w-2 rounded-full bg-foreground"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  )
}

/** The tallest the box grows before it scrolls inside itself. */
const COMPOSER_MAX_HEIGHT = 160

/**
 * The composer, pinned to the bottom: a text box with one round action at
 * its end — the microphone while it's empty, send once there's something to
 * send, as in Messages.
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

  // Grow with the text, one line at a time, up to a cap. Below the cap the
  // box can't scroll at all — a one-line field that drags sideways or up and
  // down under a finger is the thing that made this feel broken.
  React.useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT ? 'auto' : 'hidden'
  }, [value])

  const hasText = Boolean(value.trim())
  const canSend = hasText && !busy && !disabled

  return (
    // Hands the tab bar's room over to the keyboard as it arrives, on the
    // keyboard's curve, so the box rides up on top of it in one motion.
    <div className="pb-tab-bar-until-keyboard glass shrink-0 border-t md:bg-background">
      <div className="mx-auto w-full max-w-3xl pb-2 pt-2 md:px-6 md:pb-3 md:pt-3">
        {followUps.length > 0 && (
          // Phone: one row of capsules that scrolls sideways. Desktop: quiet
          // links that wrap.
          <div className="scroll-x-chips mb-2 flex gap-2 pl-4 md:flex-wrap md:gap-x-4 md:gap-y-1 md:pl-0 md:after:hidden">
            {followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  tapFeedback()
                  onFollowUp(f)
                }}
                className={cn(
                  'press text-ios-subhead h-8 shrink-0 whitespace-nowrap rounded-full bg-grouped-cell px-3.5 text-foreground ring-1 ring-inset ring-border/70',
                  'md:h-auto md:rounded-sm md:bg-transparent md:px-0 md:text-xs md:text-text-secondary md:ring-0 md:underline-offset-2 md:hover:text-foreground md:hover:underline',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                )}
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
            'mx-3 flex items-end gap-2 rounded-[20px] bg-grouped-cell py-1 pl-4 pr-1 ring-1 ring-inset ring-border/70 md:mx-0 md:bg-background',
            'md:rounded-lg md:bg-background md:py-1.5 md:pr-1.5 md:transition-shadow md:duration-fast md:focus-within:ring-2 md:focus-within:ring-brand/40',
            disabled && 'opacity-60',
          )}
        >
          <textarea
            ref={box}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) {
                e.preventDefault()
                if (canSend) onSubmit()
              }
            }}
            placeholder={
              disabled ? 'Add people first' : started ? 'Ask a follow-up' : 'Ask anything'
            }
            aria-label="Ask about your network, or say what happened"
            disabled={disabled}
            autoCapitalize="sentences"
            className={cn(
              'text-ios-body block min-h-[34px] w-full min-w-0 resize-none overflow-hidden bg-transparent py-[6px] outline-none placeholder:text-muted-foreground',
              'md:min-h-[32px] md:py-1 md:text-[15px] md:leading-6',
            )}
          />

          {/* One slot, two actions: they cross-fade in place rather than
              pushing the text box around as one replaces the other. */}
          <div className="relative mb-px h-8 w-8 shrink-0">
            <button
              type="button"
              onClick={onVoice}
              aria-label="Say who you met"
              title="Say who you met"
              tabIndex={hasText ? -1 : 0}
              aria-hidden={hasText}
              disabled={disabled}
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-full text-muted-foreground',
                'transition-[opacity,transform] duration-base ease-out',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                hasText ? 'pointer-events-none scale-75 opacity-0' : 'press scale-100 opacity-100',
              )}
            >
              <Mic className="h-[20px] w-[20px]" />
            </button>
            <button
              type="submit"
              aria-label="Send"
              tabIndex={hasText ? 0 : -1}
              aria-hidden={!hasText}
              disabled={!canSend}
              // Keeps the caret in the box on desktop; a tap on the button
              // shouldn't be what decides whether the keyboard stays.
              onPointerDown={(e) => e.preventDefault()}
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground',
                'transition-[opacity,transform] duration-base ease-[var(--ease-spring)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:opacity-40',
                hasText ? 'press-scale scale-100' : 'pointer-events-none scale-50 !opacity-0',
              )}
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
            </button>
          </div>
        </form>

        {showDisclaimer && (
          <p className="text-ios-caption mt-1.5 hidden text-muted-foreground md:block">
            Answers come from what you’ve written down. Check anything that matters.
          </p>
        )}
      </div>
    </div>
  )
}
