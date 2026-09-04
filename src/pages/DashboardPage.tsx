import { Link } from 'react-router-dom'
import {
  Users,
  UserPlus,
  AlarmClock,
  ArrowRight,
  Sparkles,
  Mic,
  KanbanSquare,
  CalendarDays,
  CalendarClock,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { AssistantLauncher } from '@/components/ai/AssistantLauncher'
import { BriefingCard } from '@/components/dashboard/BriefingCard'
import { NeedsAttention } from '@/components/dashboard/NeedsAttention'
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings'
import {
  useContacts,
  useContactMap,
  useEvents,
  useOpportunities,
  useTagMap,
} from '@/hooks/useData'
import { useUI } from '@/context/ui-context'
import { getReconnectStatus } from '@/lib/reconnect'
import { fullName, formatDate } from '@/lib/format'
import { daysSince } from '@/lib/format'
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_KEYS } from '@/lib/constants'
import type { CalendarEvent, Contact, Opportunity } from '@/types'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

/**
 * The page people land on. It answers three questions in order: what should I
 * do now (the AI briefing), who am I seeing next (the calendar), and who have
 * I let go quiet (the reconnect list) — then the slower context underneath.
 */
export function DashboardPage() {
  const contacts = useContacts()
  const opportunities = useOpportunities()
  const events = useEvents()
  const contactMap = useContactMap()
  const tagMap = useTagMap()
  const { openNewContact, openVoiceCapture, openAssistant } = useUI()

  const stats = computeStats(contacts, events, opportunities)
  const pipeline = computePipelineStats(opportunities)

  if (contacts === undefined) return <DashboardSkeleton />

  const isEmpty = contacts.length === 0

  return (
    <PageShell
      header={
        <PageHeader
          title="Dashboard"
          description="What to do next, who you're seeing, and who's gone quiet."
        >
          {/* Voice leads: adding someone should cost a sentence, not a form.
              Both are hidden on a phone, where the top bar's mic, the
              assistant bar below and the bottom-bar button already carry it. */}
          <Button onClick={openVoiceCapture} className="hidden gap-2 sm:inline-flex">
            <Mic className="h-4 w-4" />
            Say who you met
          </Button>
          <Button
            variant="outline"
            onClick={openNewContact}
            className="hidden gap-2 sm:inline-flex"
          >
            <UserPlus className="h-4 w-4" />
            New contact
          </Button>
        </PageHeader>
      }
    >
      {isEmpty ? (
        <EmptyState
          icon={Sparkles}
          title="Welcome to Retrn"
          description="Your personal CRM for everyone you meet beyond LinkedIn. Tap the mic and say who you met — or type it to the assistant. One sentence is enough."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button onClick={openVoiceCapture} className="gap-2">
                <Mic className="h-4 w-4" />
                Say who you met
              </Button>
              <Button variant="outline" onClick={() => openAssistant()} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Tell the assistant
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* The phone's headline feature, above everything else. On a laptop
              the same box lives inside the briefing card. */}
          <AssistantLauncher className="mb-4 md:hidden" />

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <StatTile
              icon={Users}
              label="Total contacts"
              value={stats.total}
              accent="text-indigo-500"
              to={ROUTES.contacts}
            />
            <StatTile
              icon={CalendarClock}
              label="Meetings this week"
              value={stats.meetingsThisWeek}
              accent="text-sky-500"
              to={ROUTES.calendar}
            />
            <StatTile
              icon={AlarmClock}
              label="Overdue"
              value={stats.overdueCount}
              accent="text-amber-500"
              to={ROUTES.contactsOverdue}
            />
            <StatTile
              icon={KanbanSquare}
              label="Open applications"
              value={stats.openOpportunities}
              accent="text-violet-500"
              to={ROUTES.pipeline}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* What to do now — model-ordered, with a rules-based fallback. */}
            <div className="lg:col-span-2">
              <BriefingCard
                contacts={contacts}
                opportunities={opportunities ?? []}
                events={events ?? []}
                tagMap={tagMap}
                ready={opportunities !== undefined && events !== undefined}
              />
            </div>

            {/* Who you're seeing next */}
            <UpcomingMeetings events={events ?? []} contactMap={contactMap} />

            {/* Who's gone quiet */}
            <div className="lg:col-span-2">
              <NeedsAttention contacts={contacts} />
            </div>

            {/* Recently added */}
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  <h2 className="font-semibold">Recently added</h2>
                </div>
                <ul className="space-y-1">
                  {stats.recent.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={ROUTES.contact(c.id)}
                        className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent/60"
                      >
                        <ContactAvatar contact={c} className="h-8 w-8 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {fullName(c)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(c.createdAt.slice(0, 10))}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pipeline snapshot */}
            <Card className="lg:col-span-3">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KanbanSquare className="h-4 w-4 text-violet-500" />
                    <h2 className="font-semibold">Recruiting pipeline</h2>
                  </div>
                  <Link
                    to={ROUTES.pipeline}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open board
                  </Link>
                </div>

                {pipeline.total === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No opportunities tracked yet.{' '}
                    <Link to={ROUTES.pipeline} className="text-indigo-500 hover:underline">
                      Add your first one
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {OPPORTUNITY_STAGE_KEYS.map((stage) => {
                        const count = pipeline.byStage[stage]
                        if (count === 0) return null
                        const s = OPPORTUNITY_STAGES[stage]
                        return (
                          <Link
                            key={stage}
                            to={ROUTES.pipeline}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                            <span>{s.label}</span>
                            <span className="font-semibold">{count}</span>
                          </Link>
                        )
                      })}
                    </div>

                    {pipeline.upcomingDeadlines.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Deadlines coming up
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {pipeline.upcomingDeadlines.map((o) => (
                            <Link
                              key={o.id}
                              to={ROUTES.pipeline}
                              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {o.company}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {o.role} · due {formatDate(o.deadline)}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  )
}

interface Stats {
  total: number
  recent: Contact[]
  overdueCount: number
  meetingsThisWeek: number
  openOpportunities: number
}

function computeStats(
  contacts: Contact[] | undefined,
  events: CalendarEvent[] | undefined,
  opportunities: Opportunity[] | undefined,
): Stats {
  const recentSorted = [...(contacts ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  // "This week" is the next seven days, not the calendar week — what's ahead
  // of you on a Friday shouldn't reset to zero on Monday.
  const meetingsThisWeek = (events ?? []).filter((e) => {
    const days = daysSince(e.startsAt)
    return days !== null && days <= 0 && days >= -7
  }).length

  return {
    total: contacts?.length ?? 0,
    recent: recentSorted.slice(0, 5),
    overdueCount: (contacts ?? []).filter((c) => getReconnectStatus(c).overdue).length,
    meetingsThisWeek,
    openOpportunities: (opportunities ?? []).filter((o) => o.stage !== 'closed').length,
  }
}

interface PipelineStats {
  total: number
  byStage: Record<Opportunity['stage'], number>
  upcomingDeadlines: Opportunity[]
}

function computePipelineStats(
  opportunities: Opportunity[] | undefined,
): PipelineStats {
  const byStage: Record<Opportunity['stage'], number> = {
    researching: 0,
    applied: 0,
    interviewing: 0,
    offer: 0,
    closed: 0,
  }
  if (!opportunities) {
    return { total: 0, byStage, upcomingDeadlines: [] }
  }
  for (const o of opportunities) byStage[o.stage]++

  const upcomingDeadlines = opportunities
    .filter((o) => {
      if (!o.deadline || o.stage === 'closed') return false
      const d = daysSince(o.deadline)
      return d !== null && d <= 0 && d >= -21
    })
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 6)

  return { total: opportunities.length, byStage, upcomingDeadlines }
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  to,
}: {
  icon: typeof Users
  label: string
  value: number
  accent: string
  to?: string
}) {
  const inner = (
    <Card
      className={cn(
        'transition-colors',
        to && 'cursor-pointer hover:border-foreground/20',
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('rounded-lg bg-muted p-2', accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function DashboardSkeleton() {
  return (
    <PageShell header={<PageHeader title="Dashboard" description="Loading your network…" />}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 w-full lg:col-span-2" />
        <Skeleton className="h-72 w-full" />
      </div>
    </PageShell>
  )
}
