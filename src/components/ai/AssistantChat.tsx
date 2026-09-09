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
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

const PLACEHOLDERS = [
  'Ask about your network, or say what happened',
  'Met Priya at the AI meetup, PM at Klaviyo',
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
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const tags = useTags() ?? []
  const tagMap = useTagMap()

  const { turns, setTurns, busy, setBusy, draft, setDraft, session, epoch, pending, handoff } =
    useAssistant()

  const threadEnd = React.useRef<HTMLDivElement>(null)
  const firstPaint = React.useRef(true)
  React.useEffect(() => {
    threadEnd.current?.scrollIntoView({
      block: 'end',
      behavior: firstPaint.current ? 'auto' : 'smooth',
    })
    firstPaint.current = false
  }, [turns, busy])

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
          toast.error('Couldn’t do that. Showing keyword matches instead.')
        }
        session.current = null
        setTurns((t) => [...t, keywordFallback(trimmed)])
      } finally {
        if (epoch.current === startedAt) setBusy(false)
      }
    },
    [busy, contacts, tagMap, keywordFallback, session, epoch, setBusy, setDraft, setTurns],
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
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
    <div className="py-8 sm:py-14">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">Ask about your network</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        {canAsk
          ? `Answers come from the ${contactCount} ${contactCount === 1 ? 'person' : 'people'} you’ve saved. Say what happened and it proposes what to record; you approve before anything is saved.`
          : 'Add a few people first. There’s nothing to ask about yet.'}
      </p>

      {canAsk && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {SUGGESTION_GROUPS.map((group) => (
            <div key={group.label} className="rounded-lg border">
              <div className="flex h-9 items-center gap-1.5 border-b px-3 text-xs font-medium text-text-secondary">
                <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {group.label}
              </div>
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex h-10 w-full items-center border-b px-3 text-left text-sm transition-colors duration-fast last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
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
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-bg-sunken px-3.5 py-2 text-[15px] leading-relaxed">
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
        className="mt-1 flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity duration-fast hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand group-hover/prose:opacity-100"
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

/** The composer: a textarea, a small mic, a send button. Pinned to the bottom. */
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

  React.useEffect(() => {
    if (value || started) return
    const timer = setInterval(() => setPlaceholder((i) => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(timer)
  }, [value, started])

  React.useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const canSend = Boolean(value.trim()) && !busy && !disabled

  return (
    <div className="shrink-0 border-t bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-3 md:px-6">
        {followUps.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            {followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFollowUp(f)}
                className="rounded-sm text-xs text-text-secondary underline-offset-2 transition-colors duration-fast hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            'flex items-end gap-1 rounded-lg border bg-background p-1.5 pl-3 transition-colors duration-fast',
            'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25',
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
              disabled
                ? 'Add a few people first'
                : started
                  ? 'Ask or say something else'
                  : PLACEHOLDERS[placeholder]
            }
            aria-label="Ask about your network, or say what happened"
            disabled={disabled}
            className="max-h-[200px] min-h-[32px] w-full resize-none bg-transparent py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onVoice}
            aria-label="Say who you met"
            title="Say who you met"
            className="shrink-0 text-muted-foreground"
          >
            <Mic />
          </Button>
          <Button type="submit" size="icon" disabled={!canSend} aria-label="Send" className="shrink-0">
            <ArrowUp />
          </Button>
        </form>

        <p className="mt-1.5 h-4 text-xs text-muted-foreground">
          {showDisclaimer ? 'Answers come from what you’ve written down. Check anything that matters.' : ''}
        </p>
      </div>
    </div>
  )
}
