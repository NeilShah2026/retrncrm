import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowUp, Check, Copy, Mic, NotebookPen, Search } from 'lucide-react'
import { useAssistant, type AssistantTurn } from '@/context/assistant-context'
import { useUI } from '@/context/ui-context'
import { useContacts, useTagMap, useTags } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { askNetwork, startSession } from '@/lib/ai/network'
import { applyActions } from '@/lib/ai/actions'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { renderMarkdown } from '@/lib/format'
import { dismissKeyboard, dismissKeyboardOnDrag } from '@/lib/keyboard'
import { tapFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { ActionPlan, MatchList } from './AssistantBlocks'
import type { Contact } from '@/types'

/**
 * The assistant, as a thread. Asking and telling share one box: "Who do I
 * know in fintech?" and "met Priya at the AI meetup" are the same gesture to
 * the person typing; only the reply differs. The model proposes; the person
 * approves; only then is anything written. If the model is unreachable this
 * becomes the fuzzy search it was built on.
 */

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
    label: 'Say what happened',
    icon: NotebookPen,
    items: [
      'Met Priya at the AI meetup, PM at Klaviyo',
      'Coffee with Sarah next Tuesday at 3',
      'Spoke to Marcus today',
    ],
  },
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
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const tags = useTags() ?? []
  const tagMap = useTagMap()

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
      try {
        const current = session.current ?? startSession()
        const { answer, session: next } = await askNetwork(current, trimmed, contacts, tagMap)
        if (epoch.current !== startedAt) return
        session.current = next
        setTurns((t) => [
          ...t,
          {
            id: nextTurnId(),
            question: trimmed,
            answer,
            fellBack: false,
            chosen: answer.actions.map(() => true),
          },
        ])
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
        setTurns((t) => [...t, keywordFallback(trimmed)])
      } finally {
        if (epoch.current === startedAt) setBusy(false)
      }
    },
    [busy, contacts, tagMap, keywordFallback, session, epoch, setBusy, setDraft, setTurns, isMobile],
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
        className="scroll-native min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin"
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4 md:px-6">
          {!started ? (
            <Opening canAsk={canAsk} contactCount={contacts.length} onPick={(s) => void ask(s)} />
          ) : (
            <div className="space-y-8">
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

/** The opening screen: a plain heading and two short lists of openers. */
function Opening({
  canAsk,
  contactCount,
  onPick,
}: {
  canAsk: boolean
  contactCount: number
  onPick: (s: string) => void
}) {
  return (
    <div className="pb-2 pt-4 sm:py-14">
      <h1 className="text-ios-title md:text-xl md:font-semibold md:tracking-[-0.02em]">
        Ask about your network
      </h1>
      {/* Folds away while typing, so the openers below keep the room. */}
      <div className="keyboard-collapse">
        <div>
          <p className="text-ios-subhead mt-2 max-w-md text-muted-foreground md:text-sm">
            {canAsk
              ? `Answers come from the ${contactCount} ${contactCount === 1 ? 'person' : 'people'} you’ve saved. Say what happened and it drafts what to record — nothing is saved until you approve it.`
              : 'Add a few people first. There’s nothing to ask about yet.'}
          </p>
        </div>
      </div>

      {canAsk && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {SUGGESTION_GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className="text-ios-footnote flex items-center gap-1.5 px-4 pb-1.5 font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
              </h2>
              <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-inset ring-border/70">
                {group.items.map((item, i) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      tapFeedback()
                      onPick(item)
                    }}
                    className="press-row flex w-full items-stretch pl-4 text-left md:hover:bg-accent/60"
                  >
                    <span
                      className={cn(
                        'text-ios-body flex min-w-0 flex-1 items-center gap-2 py-3 pr-4 md:py-2.5 md:text-sm',
                        i < group.items.length - 1 && 'hairline-b',
                      )}
                    >
                      <span className="min-w-0 flex-1">{item}</span>
                      <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-muted-foreground/50" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** One exchange: what you said, then what came back for it. */
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <p className="text-ios-body max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[6px] bg-bg-sunken px-3.5 py-2 md:rounded-lg md:text-[15px] md:leading-relaxed">
          {question}
        </p>
      </div>

      <div className="space-y-3 border-l-2 border-border pl-4">
        {fellBack && (
          <p className="text-label text-warning">Keyword search</p>
        )}
        {answer?.answer && <AnswerProse text={answer.answer} />}
        {empty && (
          <p className="text-[15px] text-muted-foreground">Nobody in your contacts fits that.</p>
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
  )
}

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
      {/* Sanitized in renderMarkdown (marked → DOMPurify). */}
      <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy this answer"
        className="mt-1 flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs text-muted-foreground transition-opacity duration-fast hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:opacity-0 md:group-hover/prose:opacity-100"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-success" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </button>
    </div>
  )
}

function Thinking({ contactCount, first }: { contactCount: number; first: boolean }) {
  const stages = React.useMemo(
    () =>
      first
        ? [
            `Reading ${contactCount} ${contactCount === 1 ? 'person' : 'people'}…`,
            'Working out what you meant…',
            'Putting an answer together…',
          ]
        : ['Thinking…', 'Checking your contacts…', 'Almost there…'],
    [contactCount, first],
  )
  const [stage, setStage] = React.useState(0)

  React.useEffect(() => {
    setStage(0)
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 2600)
    return () => clearInterval(timer)
  }, [stages])

  return (
    <div className="border-l-2 border-border pl-4">
      <p className="shimmer text-[15px]" aria-live="polite">
        {stages[stage]}
      </p>
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
    <div className="pb-tab-bar-until-keyboard shrink-0 border-t bg-background">
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
                  'press text-ios-subhead h-8 shrink-0 whitespace-nowrap rounded-full bg-bg-sunken px-3.5 text-foreground ring-1 ring-inset ring-border/70',
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
            'mx-3 flex items-end gap-2 rounded-[20px] bg-bg-sunken py-1 pl-4 pr-1 ring-1 ring-inset ring-border/70 md:mx-0',
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
