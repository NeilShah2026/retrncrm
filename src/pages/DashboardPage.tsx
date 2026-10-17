import { Link, useNavigate } from 'react-router-dom'
import { BookUser, UserPlus, PenLine, CalendarDays, QrCode, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { Logo } from '@/components/layout/AppLayout'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { AssistantLauncher } from '@/components/ai/AssistantLauncher'
import { NextUp } from '@/components/dashboard/BriefingCard'
import { NeedsAttention } from '@/components/dashboard/NeedsAttention'
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings'
import { FollowUpsPanel } from '@/components/dashboard/FollowUpsPanel'
import { RecentOutreach } from '@/components/dashboard/RecentOutreach'
import {
  useContacts,
  useContactMap,
  useEvents,
  useFollowUps,
  useKeyDates,
  useOpportunities,
  useTagMap,
} from '@/hooks/useData'
import { useUI } from '@/context/ui-context'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuth } from '@/auth/AuthProvider'
import { displayName } from '@/lib/displayName'
import { format } from 'date-fns'
import { getReconnectStatus } from '@/lib/reconnect'
import { isDue } from '@/lib/followUps'
import { fullName, formatDateShort, daysSince } from '@/lib/format'
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_KEYS } from '@/lib/constants'
import type { CalendarEvent, Contact, FollowUp, KeyDate, Opportunity } from '@/types'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

/**
 * The page people land on.
 *
 * On a laptop it is one screen, no scrolling: a line of numbers, then two
 * columns — Next up, the one list of everything with a clock on it (meetings,
 * follow-ups, people gone quiet, deadlines, birthdays) put in order by the AI,
 * and Recent outreach, who you last talked to — then the pipeline in a line.
 * Each list scrolls inside its own panel if it runs long, so the page never
 * does. The phone keeps its stacked layout.
 */
export function DashboardPage() {
  const contacts = useContacts()
  const opportunities = useOpportunities()
  const events = useEvents()
  const followUps = useFollowUps()
  const keyDates = useKeyDates()
  const contactMap = useContactMap()
  const tagMap = useTagMap()
  const { openNewContact, openVoiceCapture, openSearch, openImportContacts } = useUI()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const first = displayName(user).split(/\s+/)[0]

  return (
    <PageShell
      // The laptop layout fits the window and scrolls inside its panels.
      scrollBody={isMobile}
      mobile={{
        // `pl-2` on top of the bar's own `px-2`: the mark then starts on the
        // same 16px margin as the page's content below it, rather than four
        // pixels to its left.
        leading: <Logo className="pl-2" />,
        trailing: (
          <>
            <BarButton onClick={openSearch} aria-label="Search">
              <Search />
            </BarButton>
            <BarButton onClick={() => navigate(ROUTES.qr)} aria-label="QR code">
              <QrCode />
            </BarButton>
            <BarButton onClick={openVoiceCapture} aria-label="Say who you met">
              <PenLine />
            </BarButton>
          </>
        ),
      }}
      header={
        <PageHeader title={`${greeting()}, ${first}`} description={format(new Date(), 'EEEE, MMMM d')}>
          {/* The sidebar already carries the primary "Say who you met";
              the page header offers the form path as the secondary. */}
          <Button variant="outline" onClick={openNewContact}>
            <UserPlus />
            New contact
          </Button>
        </PageHeader>
      }
    >
      <NetworkGate
        data={contacts}
        table="contacts"
        skeleton={<DashboardSkeleton />}
        empty={
          <EmptyState
            variant="first-run"
            icon={UserPlus}
            title="Add the first person you met"
            description="One line is enough: their name, where you met, anything worth remembering. Retrn turns it into a contact."
            action={
              <>
                <Button onClick={openVoiceCapture}>
                  <PenLine />
                  Say who you met
                </Button>
                <Button variant="outline" onClick={openNewContact}>
                  New contact
                </Button>
                <Button variant="outline" onClick={openImportContacts}>
                  <BookUser />
                  Import contacts
                </Button>
              </>
            }
          />
        }
      >
        {(list) =>
          isMobile ? (
            <DashboardBody
              contacts={list}
              opportunities={opportunities}
              events={events}
              followUps={followUps ?? []}
              contactMap={contactMap}
              tagMap={tagMap}
            />
          ) : (
            <DesktopDashboard
              contacts={list}
              opportunities={opportunities}
              events={events}
              followUps={followUps}
              keyDates={keyDates}
              tagMap={tagMap}
            />
          )
        }
      </NetworkGate>
    </PageShell>
  )
}

function DashboardBody({
  contacts,
  opportunities,
  events,
  followUps,
  contactMap,
  tagMap,
}: {
  contacts: Contact[]
  opportunities: Opportunity[] | undefined
  events: CalendarEvent[] | undefined
  followUps: FollowUp[]
  contactMap: Map<string, Contact>
  tagMap: ReturnType<typeof useTagMap>
}) {
  const stats = computeStats(contacts, events, opportunities, followUps)
  const pipeline = computePipelineStats(opportunities)

  return (
    <>
      <AssistantLauncher className="mb-4 md:hidden" />

      <MetricStrip stats={stats} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextUp
            contacts={contacts}
            opportunities={opportunities ?? []}
            events={events ?? []}
            tagMap={tagMap}
            ready={opportunities !== undefined && events !== undefined}
          />
        </div>

        <UpcomingMeetings events={events ?? []} contactMap={contactMap} />

        <div className="lg:col-span-2">
          <FollowUpsPanel followUps={followUps} contactMap={contactMap} />
        </div>

        <div className="lg:col-span-2">
          <NeedsAttention contacts={contacts} />
        </div>

        <Panel>
          <PanelHeader>Recently added</PanelHeader>
          <ul>
            {stats.recent.map((c) => (
              <li key={c.id} className="border-b last:border-b-0">
                <Link
                  to={ROUTES.contact(c.id)}
                  className="flex h-10 items-center gap-2.5 px-4 transition-colors duration-fast hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent"
                >
                  <ContactAvatar contact={c} className="h-6 w-6" />
                  <span className="min-w-0 flex-1 truncate text-sm">{fullName(c)}</span>
                  <time className="text-xs text-muted-foreground">
                    {formatDateShort(c.createdAt.slice(0, 10))}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="lg:col-span-3">
          <PanelHeader
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to={ROUTES.pipeline}>Open board</Link>
              </Button>
            }
          >
            Pipeline
          </PanelHeader>

          {pipeline.total === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No opportunities yet.{' '}
              <Link to={ROUTES.pipelineNew} className="text-brand hover:underline">
                Add the first one
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
                {OPPORTUNITY_STAGE_KEYS.map((stage) => {
                  const count = pipeline.byStage[stage]
                  if (count === 0) return null
                  const s = OPPORTUNITY_STAGES[stage]
                  return (
                    <Link
                      key={stage}
                      to={ROUTES.pipeline}
                      className="inline-flex items-center gap-1.5 text-text-secondary hover:text-foreground"
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                      {s.label}
                      <span className="tnum font-medium text-foreground">{count}</span>
                    </Link>
                  )
                })}
              </div>

              {pipeline.upcomingDeadlines.length > 0 && (
                <div className="border-t">
                  <p className="text-label px-4 pb-1 pt-3 text-muted-foreground">
                    Deadlines in the next three weeks
                  </p>
                  <ul>
                    {pipeline.upcomingDeadlines.map((o) => (
                      <li key={o.id} className="border-b last:border-b-0">
                        <Link
                          to={ROUTES.pipeline}
                          className="flex h-9 items-center gap-2.5 px-4 text-sm transition-colors duration-fast hover:bg-accent/60"
                        >
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{o.company}</span>
                            <span className="text-muted-foreground"> · {o.role}</span>
                          </span>
                          <time className="tnum text-xs text-muted-foreground">
                            {formatDateShort(o.deadline)}
                          </time>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function DesktopDashboard({
  contacts,
  opportunities,
  events,
  followUps,
  keyDates,
  tagMap,
}: {
  contacts: Contact[]
  opportunities: Opportunity[] | undefined
  events: CalendarEvent[] | undefined
  followUps: FollowUp[] | undefined
  keyDates: KeyDate[] | undefined
  tagMap: ReturnType<typeof useTagMap>
}) {
  const stats = computeStats(contacts, events, opportunities, followUps ?? [])
  const pipeline = computePipelineStats(opportunities)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-5">
      <MetricStrip stats={stats} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-rows-[minmax(0,1fr)] gap-4">
        <NextUp
          contacts={contacts}
          opportunities={opportunities ?? []}
          events={events ?? []}
          followUps={followUps ?? []}
          keyDates={keyDates ?? []}
          tagMap={tagMap}
          ready={
            opportunities !== undefined &&
            events !== undefined &&
            followUps !== undefined &&
            keyDates !== undefined
          }
          className="min-h-0"
        />
        <RecentOutreach contacts={contacts} className="min-h-0" />
      </div>
      <PipelineLine pipeline={pipeline} />
    </div>
  )
}

/** The pipeline in one line: counts by stage and the next deadline. */
function PipelineLine({ pipeline }: { pipeline: PipelineStats }) {
  const next = pipeline.upcomingDeadlines[0]
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border px-4 py-2.5 text-sm">
      <span className="font-medium">Pipeline</span>
      {pipeline.total === 0 ? (
        <span className="text-muted-foreground">
          No applications yet.{' '}
          <Link to={ROUTES.pipelineNew} className="text-brand hover:underline">
            Add one
          </Link>
        </span>
      ) : (
        OPPORTUNITY_STAGE_KEYS.filter((stage) => stage !== 'closed' && pipeline.byStage[stage] > 0).map(
          (stage) => (
            <Link
              key={stage}
              to={ROUTES.pipeline}
              className="inline-flex items-center gap-1.5 text-text-secondary hover:text-foreground"
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', OPPORTUNITY_STAGES[stage].dot)} />
              {OPPORTUNITY_STAGES[stage].label}
              <span className="tnum font-medium text-foreground">{pipeline.byStage[stage]}</span>
            </Link>
          ),
        )
      )}
      <span className="ml-auto flex items-center gap-3">
        {next && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Next deadline: <span className="text-foreground">{next.company}</span>{' '}
            {formatDateShort(next.deadline)}
          </span>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.pipeline}>Open board</Link>
        </Button>
      </span>
    </div>
  )
}

/**
 * The numbers, in one line. Unequal on purpose: contacts and overdue are the
 * two that change what you do today; the rest are context.
 */
function MetricStrip({ stats }: { stats: Stats }) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border px-4 py-3">
      <Metric
        to={ROUTES.contacts}
        value={stats.total}
        label={stats.total === 1 ? 'contact' : 'contacts'}
        emphasis
      />
      <Metric
        to={ROUTES.contacts}
        value={stats.reachedLately}
        label="reached in 30 days"
        emphasis
      />
      <Metric
        to={ROUTES.contactsOverdue}
        value={stats.overdueCount}
        label="due to reconnect"
        emphasis
        tone={stats.overdueCount > 0 ? 'warning' : undefined}
      />
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
      <Metric to={ROUTES.calendar} value={stats.meetingsThisWeek} label="meetings this week" />
      <Metric to={ROUTES.pipeline} value={stats.openOpportunities} label="open applications" />
    </dl>
  )
}

function Metric({
  to,
  value,
  label,
  emphasis,
  tone,
}: {
  to: string
  value: number
  label: string
  emphasis?: boolean
  tone?: 'warning'
}) {
  return (
    <Link
      to={to}
      className="group inline-flex items-baseline gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <dd
        className={cn(
          'tnum font-semibold leading-none',
          emphasis ? 'text-xl' : 'text-base',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </dd>
      <dt
        className={cn(
          'text-muted-foreground group-hover:text-foreground',
          emphasis ? 'text-sm' : 'text-xs',
        )}
      >
        {label}
      </dt>
    </Link>
  )
}

interface Stats {
  total: number
  recent: Contact[]
  overdueCount: number
  /** People last contacted in the past 30 days. */
  reachedLately: number
  followUpsDue: number
  meetingsThisWeek: number
  openOpportunities: number
}

function computeStats(
  contacts: Contact[] | undefined,
  events: CalendarEvent[] | undefined,
  opportunities: Opportunity[] | undefined,
  followUps: FollowUp[],
): Stats {
  const recentSorted = [...(contacts ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  // "This week" is the next seven days, not the calendar week.
  const meetingsThisWeek = (events ?? []).filter((e) => {
    const days = daysSince(e.startsAt)
    return days !== null && days <= 0 && days >= -7
  }).length

  return {
    total: contacts?.length ?? 0,
    recent: recentSorted.slice(0, 5),
    overdueCount: (contacts ?? []).filter((c) => getReconnectStatus(c).overdue).length,
    reachedLately: (contacts ?? []).filter((c) => {
      const days = daysSince(c.lastContactDate)
      return days !== null && days <= 30
    }).length,
    followUpsDue: followUps.filter((f) => isDue(f)).length,
    meetingsThisWeek,
    openOpportunities: (opportunities ?? []).filter((o) => o.stage !== 'closed').length,
  }
}

interface PipelineStats {
  total: number
  byStage: Record<Opportunity['stage'], number>
  upcomingDeadlines: Opportunity[]
}

function computePipelineStats(opportunities: Opportunity[] | undefined): PipelineStats {
  const byStage: Record<Opportunity['stage'], number> = {
    researching: 0,
    applied: 0,
    interviewing: 0,
    offer: 0,
    closed: 0,
  }
  if (!opportunities) return { total: 0, byStage, upcomingDeadlines: [] }
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

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your network">
      <div className="flex h-12 items-center gap-6 rounded-lg border px-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border lg:col-span-2">
          <div className="h-11 border-b px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex h-11 items-center gap-3 border-b px-4 last:border-b-0">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border">
          <div className="h-11 border-b px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-3 p-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  )
}
