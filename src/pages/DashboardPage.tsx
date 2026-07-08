import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserPlus,
  AlarmClock,
  Tag as TagIcon,
  ArrowRight,
  MessageSquarePlus,
  Sparkles,
  CalendarClock,
  Coffee,
  KanbanSquare,
  CalendarDays,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { ReconnectBadge } from '@/components/common/ReconnectBadge'
import { LogInteractionDialog } from '@/components/contacts/LogInteractionDialog'
import { CoffeeChatPrepDialog } from '@/components/contacts/CoffeeChatPrepDialog'
import { useContacts, useOpportunities, useTags } from '@/hooks/useData'
import { useUI } from '@/context/ui-context'
import { getReconnectStatus } from '@/lib/reconnect'
import { fullName, formatRelative, formatDate } from '@/lib/format'
import { daysSince } from '@/lib/format'
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_KEYS,
} from '@/lib/constants'
import type { Contact, Opportunity } from '@/types'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

export function DashboardPage() {
  const contacts = useContacts()
  const tags = useTags()
  const opportunities = useOpportunities()
  const { openNewContact } = useUI()
  const [logTarget, setLogTarget] = React.useState<Contact | null>(null)
  const [prepTarget, setPrepTarget] = React.useState<Contact | null>(null)

  const stats = React.useMemo(() => computeStats(contacts), [contacts])
  const pipeline = React.useMemo(
    () => computePipelineStats(opportunities),
    [opportunities],
  )

  if (contacts === undefined) return <DashboardSkeleton />

  const isEmpty = contacts.length === 0

  return (
    <PageShell
      header={
        <PageHeader
          title="Dashboard"
          description="Your network at a glance — who to reconnect with, and who's new."
        >
          <Button onClick={openNewContact} className="gap-2">
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
          description="Your personal CRM for everyone you meet beyond LinkedIn. Add your first contact to get started — a name and how you met is enough."
          action={<Button onClick={openNewContact}>Add your first contact</Button>}
        />
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={Users}
              label="Total contacts"
              value={stats.total}
              accent="text-indigo-500"
              to={ROUTES.contacts}
            />
            <StatTile
              icon={UserPlus}
              label="Added (30 days)"
              value={stats.recentCount}
              accent="text-emerald-500"
            />
            <StatTile
              icon={AlarmClock}
              label="Overdue"
              value={stats.overdue.length}
              accent="text-red-500"
              to={ROUTES.contactsOverdue}
            />
            <StatTile
              icon={TagIcon}
              label="Tags"
              value={tags?.length ?? 0}
              accent="text-violet-500"
              to={ROUTES.tags}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Reconnect suggestions */}
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlarmClock className="h-4 w-4 text-red-500" />
                    <h2 className="font-semibold">Reconnect suggestions</h2>
                  </div>
                  <Link
                    to={ROUTES.contactsOverdue}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View all
                  </Link>
                </div>
                {stats.overdue.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    🎉 You're all caught up — no one is overdue right now.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {stats.overdue.slice(0, 6).map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <Link
                          to={ROUTES.contact(c.id)}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <ContactAvatar
                            contact={c}
                            className="h-9 w-9 shrink-0 text-xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {fullName(c)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.company || 'No company'} ·{' '}
                              {c.lastContactDate
                                ? `last ${formatRelative(c.lastContactDate)}`
                                : 'never contacted'}
                            </p>
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center justify-between gap-2 pl-12 sm:justify-end sm:gap-1.5 sm:pl-0">
                          <ReconnectBadge contact={c} />
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setPrepTarget(c)}
                              aria-label={`Prep to reconnect with ${fullName(c)}`}
                              title="Prep for reconnect"
                            >
                              <Coffee className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setLogTarget(c)}
                              aria-label={`Log interaction with ${fullName(c)}`}
                              title="Log interaction"
                            >
                              <MessageSquarePlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

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
                        <ContactAvatar
                          contact={c}
                          className="h-8 w-8 text-xs"
                        />
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

            {/* Upcoming follow-ups */}
            <Card className="lg:col-span-3">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-semibold">Upcoming follow-ups</h2>
                  <span className="text-xs text-muted-foreground">
                    · due within 2 weeks
                  </span>
                </div>
                {stats.upcoming.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing due soon. Set a cadence goal on a contact to see
                    follow-ups here.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.upcoming.map(({ contact: c, due }) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <Link
                          to={ROUTES.contact(c.id)}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <ContactAvatar
                            contact={c}
                            className="h-9 w-9 text-xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {fullName(c)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              Due in {due} {due === 1 ? 'day' : 'days'}
                            </p>
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPrepTarget(c)}
                          aria-label={`Prep to reconnect with ${fullName(c)}`}
                          title="Prep for reconnect"
                        >
                          <Coffee className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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

      <CoffeeChatPrepDialog
        open={Boolean(prepTarget)}
        onOpenChange={(o) => !o && setPrepTarget(null)}
        contactId={prepTarget?.id}
        onLogInteraction={() => {
          const c = prepTarget
          setPrepTarget(null)
          if (c) setLogTarget(c)
        }}
      />
      <LogInteractionDialog
        open={Boolean(logTarget)}
        onOpenChange={(o) => !o && setLogTarget(null)}
        contactId={logTarget?.id ?? ''}
      />
    </PageShell>
  )
}

interface Stats {
  total: number
  recentCount: number
  recent: Contact[]
  overdue: Contact[]
  upcoming: { contact: Contact; due: number }[]
}

function computeStats(contacts: Contact[] | undefined): Stats {
  if (!contacts) {
    return { total: 0, recentCount: 0, recent: [], overdue: [], upcoming: [] }
  }

  const recentSorted = [...contacts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const recentCount = contacts.filter((c) => {
    const d = daysSince(c.createdAt.slice(0, 10))
    return d !== null && d <= 30
  }).length

  const overdue = contacts
    .map((c) => ({ c, s: getReconnectStatus(c) }))
    .filter((x) => x.s.overdue)
    .sort((a, b) => (b.s.overdueBy ?? 0) - (a.s.overdueBy ?? 0))
    .map((x) => x.c)

  const upcoming = contacts
    .map((c) => ({ contact: c, s: getReconnectStatus(c) }))
    .filter(
      (x) =>
        !x.s.overdue &&
        x.s.goalDays !== null &&
        x.s.overdueBy !== null &&
        -x.s.overdueBy <= 14,
    )
    .map((x) => ({ contact: x.contact, due: -(x.s.overdueBy as number) }))
    .sort((a, b) => a.due - b.due)

  return {
    total: contacts.length,
    recentCount,
    recent: recentSorted.slice(0, 5),
    overdue,
    upcoming,
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
