import * as React from 'react'
import type { NetworkAnswer, NetworkSession } from '@/lib/ai/network'
import type { ActionOutcome } from '@/lib/ai/actions'

/**
 * One message and everything that came back for it — the question, the prose,
 * the people it found, and the plan it wants to run.
 */
export interface AssistantTurn {
  /** Stable across re-renders so React keys survive a plan being run. */
  id: string
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

interface AssistantContextValue {
  turns: AssistantTurn[]
  setTurns: React.Dispatch<React.SetStateAction<AssistantTurn[]>>
  busy: boolean
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
  /** What's typed in the composer, kept so leaving mid-sentence isn't punished. */
  draft: string
  setDraft: React.Dispatch<React.SetStateAction<string>>
  /** The model thread. A ref because it changes per answer, not per render. */
  session: React.MutableRefObject<NetworkSession | null>
  /**
   * Bumped by `reset`. An ask that was already in flight compares this against
   * the value it started with and drops its answer if the thread moved on —
   * otherwise "New chat" is undone a few seconds later by the reply to a
   * question that is no longer on screen.
   */
  epoch: React.MutableRefObject<number>
  /** Handed over from ⌘K, the dashboard, or a nav click; the chat runs it once. */
  pending: React.MutableRefObject<string | null>
  /** Bumped when something is queued, so the chat notices a repeat handover. */
  handoff: number
  /** Queue a question and mark it for the chat to pick up. */
  handOff: (question: string) => void
  reset: () => void
}

const AssistantContext = React.createContext<AssistantContextValue | null>(null)

/**
 * The assistant thread, hoisted out of the screen that draws it.
 *
 * The chat is a route now, so walking off to a contact and coming back used to
 * mean losing the conversation. Holding it here means the thread — and any
 * request still in flight — outlives the page: an answer that lands while
 * you're reading someone's profile is waiting when you get back.
 *
 * Deliberately only state. The asking itself stays in the chat component,
 * which already has the contacts and tags loaded; putting it here would make
 * every screen in the app pay for a roster it may never use.
 *
 * Session-scoped: a reload starts fresh. There is no conversation history.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [turns, setTurns] = React.useState<AssistantTurn[]>([])
  const [busy, setBusy] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [handoff, setHandoff] = React.useState(0)
  const session = React.useRef<NetworkSession | null>(null)
  const pending = React.useRef<string | null>(null)
  const epoch = React.useRef(0)

  const reset = React.useCallback(() => {
    epoch.current += 1
    session.current = null
    pending.current = null
    setTurns([])
    setDraft('')
    setBusy(false)
  }, [])

  const handOff = React.useCallback((question: string) => {
    const trimmed = question.trim()
    if (!trimmed) return
    pending.current = trimmed
    setHandoff((n) => n + 1)
  }, [])

  const value = React.useMemo(
    () => ({
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
      handOff,
      reset,
    }),
    [turns, busy, draft, handoff, handOff, reset],
  )

  return (
    <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
  )
}

export function useAssistant(): AssistantContextValue {
  const ctx = React.useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider')
  return ctx
}
