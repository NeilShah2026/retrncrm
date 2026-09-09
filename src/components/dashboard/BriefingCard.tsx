import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  Check,
  Coffee,
  KanbanSquare,
  PenLine,
  RefreshCw,
} from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SuggestedBadge } from '@/components/ui/badge'
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
import { AiUnavailableError } from '@/lib/ai/client'
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
  /** False while any of the three lists is still loading. */
  ready: boolean
}

const KIND: Record<BriefingKind, { icon: typeof Coffee; label: string }> = {
  prep: { icon: Coffee, label: 'Prep' },
  reconnect: { icon: AlarmClock, label: 'Reconnect' },
  draft: { icon: PenLine, label: 'Write' },
  pipeline: { icon: KanbanSquare, label: 'Pipeline' },
}

const ASK_SUGGESTIONS = [
  'Who should I reconnect with this week?',
  'Who do I know in fintech?',
  'Who could refer me for an internship?',
]

/**
 * "Next up": today's short list, as rows. Everything here exists elsewhere
 * in the app — overdue people, the next meetings, deadlines. What this adds
 * is an order and a reason. When the model wrote the order, the panel says
 * so with a text badge; when the rules did, it says nothing.
 */
export function NextUp({ contacts, opportunities, events, tagMap, ready }: Props) {
  const navigate = useNavigate()
  const { openAssistant } = useUI()

  const snapshot = React.useMemo(
    () => buildSnapshot(contacts, opportunities, events),
    [contacts, opportunities, events],
  )
  const fingerprint = React.useMemo(() => snapshotFingerprint(snapshot), [snapshot])

  const latest = React.useRef({ snapshot, tagMap })
  latest.current = { snapshot, tagMap }

  const [briefing, setBriefing] = React.useState<Briefing | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [prepContactId, setPrepContactId] = React.useState<string | undefined>()
  const [question, setQuestion] = React.useState('')

  const generatedFor = React.useRef<string | null>(null)
  const current = React.useRef<Briefing | null>(null)
  current.current = briefing

  const run = React.useCallback(async (force: boolean, signal?: AbortSignal) => {
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
  }, [])

  React.useEffect(() => {
    if (!ready || generatedFor.current === fingerprint) return
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
  const pending = (!ready || loading) && !briefing

  return (
    <Panel>
      <PanelHeader
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void run(true)}
            disabled={!ready || loading || empty}
            aria-label="Rebuild the list"
            title="Rebuild the list"
            className="text-muted-foreground"
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </Button>
        }
      >
        <span className="flex items-center gap-2">
          Next up
          {briefing?.fromModel && !empty && <SuggestedBadge />}
        </span>
      </PanelHeader>

      {pending ? (
        <ul aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex h-11 items-center gap-3 border-b px-4 last:border-b-0">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-56" />
            </li>
          ))}
        </ul>
      ) : empty ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Nothing overdue and nothing scheduled. Add people as you meet them
          and this list fills in on its own.
        </p>
      ) : (
        <>
          {briefing?.headline && (
            <p className="border-b px-4 py-2.5 text-sm text-muted-foreground">
              {briefing.headline}
            </p>
          )}
          <ul>
            {briefing?.actions.map((action, i) => (
              <ActionRow
                key={`${action.kind}-${action.contact?.id ?? action.opportunity?.id ?? i}`}
                action={action}
                onOpen={() => openAction(action)}
                onPrep={action.contact ? () => setPrepContactId(action.contact?.id) : undefined}
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
        className="hidden items-center gap-2 border-t px-3 py-2.5 md:flex"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your network…"
          aria-label="Ask about your network"
          className="border-transparent bg-transparent shadow-none hover:border-border"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!question.trim()}>
          Ask
        </Button>
      </form>
      <div className="hidden flex-wrap gap-x-4 gap-y-1 px-4 pb-3 md:flex">
        {ASK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => openAssistant(s)}
            className="rounded-sm text-xs text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {s}
          </button>
        ))}
      </div>

      <CoffeeChatPrepDialog
        open={Boolean(prepContactId)}
        onOpenChange={(open) => !open && setPrepContactId(undefined)}
        contactId={prepContactId}
      />
    </Panel>
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
  const kind = KIND[action.kind]
  const Icon = kind.icon
  const contact = action.contact

  return (
    <li className="group flex items-center gap-3 border-b px-4 last:border-b-0 hover:bg-accent/50">
      <button
        onClick={onOpen}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2 text-left focus-visible:outline-none"
      >
        {contact ? (
          <ContactAvatar contact={contact} className="h-6 w-6 shrink-0" />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-bg-sunken text-muted-foreground">
            <Icon className="h-3 w-3" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{action.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            <span className="text-text-secondary">{kind.label}</span> · {action.why}
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {onPrep && (action.kind === 'prep' || action.kind === 'draft') && (
          <Button variant="ghost" size="sm" onClick={onPrep}>
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
            <Check />
          </Button>
        )}
      </div>
    </li>
  )
}

/** @deprecated Use NextUp. Kept so older imports resolve. */
export const BriefingCard = NextUp
