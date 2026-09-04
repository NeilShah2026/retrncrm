import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Check, Loader2, RotateCcw, Search, Send, Sparkles } from 'lucide-react'
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
import { useContacts, useTagMap } from '@/hooks/useData'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { askNetwork, startSession } from '@/lib/ai/network'
import type { NetworkAnswer, NetworkSession } from '@/lib/ai/network'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { markCaughtUp } from '@/lib/caughtUp'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Carried over from the ⌘K palette, so the question isn't retyped. */
  initialQuestion?: string
}

const SUGGESTIONS = [
  'Who do I know in fintech?',
  'Who should I ask about product internships?',
  'Who should I reconnect with this week?',
  'Who could introduce me to someone at a startup?',
]

/** One question and what came back for it. */
interface Turn {
  question: string
  answer: NetworkAnswer | null
  /** True when the answer came from Fuse because the model was unavailable. */
  fellBack: boolean
}

/**
 * Search by memory rather than by string: "who did I meet who works in
 * healthcare?" The ⌘K palette answers what you can already name; this answers
 * what you can only describe — and it holds a thread, so "which of them have I
 * not spoken to since spring?" is a follow-up rather than a fresh question.
 *
 * If the model is unreachable this quietly becomes the fuzzy search it was
 * built on top of — a worse answer, but never no answer.
 */
export function AskNetworkDialog({ open, onOpenChange, initialQuestion }: Props) {
  const navigate = useNavigate()
  const loaded = useContacts()
  // Stable identity: the roster and the Fuse index both key off this.
  const contacts = React.useMemo(() => loaded ?? [], [loaded])
  const tagMap = useTagMap()

  const [question, setQuestion] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [turns, setTurns] = React.useState<Turn[]>([])
  const session = React.useRef<NetworkSession | null>(null)
  const threadEnd = React.useRef<HTMLDivElement>(null)
  /** A question handed over from the ⌘K palette or the dashboard, to run once. */
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
    // Someone who typed the question elsewhere shouldn't have to press Ask.
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
        answer: {
          answer: found.length
            ? 'Keyword matches from your contacts.'
            : 'No keyword matches either — try a company or a tag.',
          matches: found.map((contact) => ({ contact, reason: '' })),
          followUps: [],
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
      setTurns((t) => [...t, { question: trimmed, answer, fellBack: false }])
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        toast.info('AI isn’t set up here — showing keyword matches.')
      } else {
        console.error(err)
        toast.error('Couldn’t ask that — showing keyword matches instead.')
      }
      // A thread the model never saw can't be followed up on.
      session.current = null
      setTurns((t) => [...t, keywordFallback(trimmed)])
    } finally {
      setBusy(false)
    }
  }

  // A question handed over from elsewhere runs itself — but only once the
  // contacts have loaded, since there's no roster to ask against before then.
  const askRef = React.useRef(ask)
  askRef.current = ask
  React.useEffect(() => {
    const pending = autoAsk.current
    if (!open || !pending || contacts.length === 0) return
    autoAsk.current = null
    void askRef.current(pending)
  }, [open, contacts.length])

  function openContact(contact: Contact) {
    onOpenChange(false)
    navigate(ROUTES.contact(contact.id))
  }

  const canAsk = contacts.length > 0
  const started = turns.length > 0 || busy
  const last = turns[turns.length - 1]
  const followUps = !busy && !last?.fellBack ? (last?.answer?.followUps ?? []) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
            Ask your network
            {started && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="ml-auto gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Start over
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Describe who you're looking for — “someone in fintech in Boston”,
            “who could review a resume”. Ask follow-ups; it remembers the
            thread. Searches only your own contacts.
          </DialogDescription>
        </DialogHeader>

        {!canAsk && (
          <p className="text-sm text-muted-foreground">
            Add a few people first — there's nothing to search yet.
          </p>
        )}

        {canAsk && !started && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {started && (
          <div className="max-h-[48vh] space-y-5 overflow-y-auto scrollbar-thin pr-1">
            {turns.map((turn, i) => (
              <TurnBlock
                key={i}
                turn={turn}
                onOpenContact={openContact}
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
          <div className="flex flex-wrap gap-1.5">
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
          className="flex gap-2"
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={started ? 'Ask a follow-up…' : 'Who do I know that…'}
            autoFocus
            disabled={!canAsk}
          />
          <Button type="submit" disabled={!question.trim() || busy || !canAsk}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : started ? (
              <Send className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Ask</span>
          </Button>
        </form>

        {started && !last?.fellBack && isAiAvailable() && (
          <p className="text-[11px] text-muted-foreground">
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
}: {
  turn: Turn
  onOpenContact: (contact: Contact) => void
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
      {answer && answer.matches.length === 0 && !answer.answer && (
        <p className="text-sm text-muted-foreground">
          Nobody in your contacts fits that.
        </p>
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
