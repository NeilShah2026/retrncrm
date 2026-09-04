import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Search, Sparkles } from 'lucide-react'
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
import { askNetwork } from '@/lib/ai/network'
import type { NetworkMatch } from '@/lib/ai/network'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
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

/**
 * Search by memory rather than by string: "who did I meet who works in
 * healthcare?" The ⌘K palette answers what you can already name; this answers
 * what you can only describe.
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
  const [matches, setMatches] = React.useState<NetworkMatch[] | null>(null)
  const [summary, setSummary] = React.useState('')
  const [askedFor, setAskedFor] = React.useState('')
  /** True when the answer came from Fuse because the model was unavailable. */
  const [fellBack, setFellBack] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setQuestion(initialQuestion ?? '')
    setMatches(null)
    setSummary('')
    setFellBack(false)
  }, [open, initialQuestion])

  const fuse = React.useMemo(
    () => buildSearchIndex(contacts, tagMap),
    [contacts, tagMap],
  )

  /** The non-AI path, used on its own merits and as the failure path. */
  const keywordFallback = React.useCallback(
    (q: string) => {
      const found = searchContacts(fuse, q).slice(0, 8)
      setFellBack(true)
      setMatches(found.map((contact) => ({ contact, reason: '' })))
      setSummary(
        found.length
          ? 'Keyword matches from your contacts.'
          : 'No keyword matches either — try a company or a tag.',
      )
    },
    [fuse],
  )

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setAskedFor(trimmed)
    setFellBack(false)
    try {
      const answer = await askNetwork(trimmed, contacts, tagMap)
      setMatches(answer.matches)
      setSummary(answer.summary ?? '')
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        toast.info('AI isn’t set up here — showing keyword matches.')
      } else {
        console.error(err)
        toast.error('Couldn’t ask that — showing keyword matches instead.')
      }
      keywordFallback(trimmed)
    } finally {
      setBusy(false)
    }
  }

  function openContact(contact: Contact) {
    onOpenChange(false)
    navigate(ROUTES.contact(contact.id))
  }

  const canAsk = contacts.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
            Ask your network
          </DialogTitle>
          <DialogDescription>
            Describe who you're looking for — “someone in fintech in Boston”,
            “who could review a resume”. Searches only your own contacts.
          </DialogDescription>
        </DialogHeader>

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
            placeholder="Who do I know that…"
            autoFocus
            disabled={!canAsk}
          />
          <Button type="submit" disabled={!question.trim() || busy || !canAsk}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Ask</span>
          </Button>
        </form>

        {!canAsk && (
          <p className="text-sm text-muted-foreground">
            Add a few people first — there's nothing to search yet.
          </p>
        )}

        {canAsk && !matches && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s)
                  void ask(s)
                }}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {busy && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Reading through {contacts.length}{' '}
            {contacts.length === 1 ? 'person' : 'people'}…
          </p>
        )}

        {!busy && matches && (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto scrollbar-thin pr-1">
            {summary && (
              <p className="text-sm text-muted-foreground">
                {fellBack && <span className="font-medium">Keyword search: </span>}
                {summary}
              </p>
            )}
            {matches.length === 0 && !summary && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nobody in your contacts fits “{askedFor}”.
              </p>
            )}
            {matches.map(({ contact, reason }) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => openContact(contact)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/60"
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
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {!busy && matches && !fellBack && isAiAvailable() && (
          <p className="text-[11px] text-muted-foreground">
            Answers come from what you've written down about these people —
            check anything that matters before you act on it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
