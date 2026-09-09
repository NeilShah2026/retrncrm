import * as React from 'react'
import {
  Check,
  LayoutGrid,
  Mic,
  RotateCcw,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { AssistantLauncher } from '@/components/ai/AssistantLauncher'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import type { WidgetContext } from '@/components/dashboard/registry'
import {
  useContacts,
  useContactMap,
  useEvents,
  useOpportunities,
  useTagMap,
  useTags,
} from '@/hooks/useData'
import { useDashboardLayout } from '@/hooks/useDashboardLayout'
import { useUI } from '@/context/ui-context'
import { computeDashboardStats } from '@/lib/dashboardStats'
import { isDefaultLayout } from '@/lib/dashboardLayout'

/**
 * The page people land on — and, since no two people use a CRM the same way,
 * the one page they get to build themselves.
 *
 * Out of the box it still answers the three questions in order: what should I
 * do now (the briefing), who am I seeing next (the calendar), and who have I
 * let go quiet (the reconnect list). But that order is only a good default.
 * Someone living out of the recruiting board and someone who mostly captures
 * people they met want different home screens, so every card here is a widget
 * that can be moved, resized, put away, or brought back — and the arrangement
 * is saved on the account, not the browser.
 */
export function DashboardPage() {
  const contacts = useContacts()
  const opportunities = useOpportunities()
  const events = useEvents()
  const contactMap = useContactMap()
  const tagMap = useTagMap()
  const tags = useTags()
  const { openNewContact, openVoiceCapture, openAssistant, openSearch } = useUI()
  const { layout, visible, hidden, move, resize, hide, show, reset } =
    useDashboardLayout()

  const [editing, setEditing] = React.useState(false)

  const stats = React.useMemo(
    () => computeDashboardStats(contacts ?? [], events ?? [], opportunities ?? []),
    [contacts, events, opportunities],
  )

  if (contacts === undefined) return <DashboardSkeleton />

  const isEmpty = contacts.length === 0

  const ctx: WidgetContext = {
    contacts,
    opportunities: opportunities ?? [],
    events: events ?? [],
    contactMap,
    tagMap,
    tags: tags ?? [],
    stats,
    ready: opportunities !== undefined && events !== undefined,
  }

  return (
    <PageShell
      mobile={{
        leading: <MobileBrand />,
        trailing: isEmpty ? (
          <>
            <BarButton onClick={openSearch} aria-label="Search">
              <Search />
            </BarButton>
            <BarButton onClick={openVoiceCapture} aria-label="Say who you met">
              <Mic />
            </BarButton>
          </>
        ) : editing ? (
          <BarButton onClick={() => setEditing(false)} aria-label="Done arranging">
            <Check />
          </BarButton>
        ) : (
          <>
            <BarButton
              onClick={() => setEditing(true)}
              aria-label="Arrange your dashboard"
            >
              <LayoutGrid />
            </BarButton>
            <BarButton onClick={openSearch} aria-label="Search">
              <Search />
            </BarButton>
            <BarButton onClick={openVoiceCapture} aria-label="Say who you met">
              <PenLine />
            </BarButton>
          </>
        ),
      }}
      header={
        <PageHeader
          title="Dashboard"
          description={
            editing
              ? 'Drag a widget by its handle. Everything saves as you go.'
              : "What to do next, who you're seeing, and who's gone quiet."
          }
        >
          {editing ? (
            <>
              <Button
                variant="ghost"
                onClick={reset}
                disabled={isDefaultLayout(layout)}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button onClick={() => setEditing(false)} className="gap-2">
                <Check className="h-4 w-4" />
                Done
              </Button>
            </>
          ) : (
            <>
              {/* Voice leads: adding someone should cost a sentence, not a form. */}
              <Button onClick={openVoiceCapture} className="gap-2">
                <Mic className="h-4 w-4" />
                Say who you met
              </Button>
              <Button variant="outline" onClick={openNewContact} className="gap-2">
                <UserPlus className="h-4 w-4" />
                New contact
              </Button>
              {!isEmpty && (
                <Button
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Customize
                </Button>
              )}
            </>
          )}
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
              the same box lives inside the briefing card. It sits outside the
              grid deliberately: it's the way into the app, not a panel to be
              rearranged away. */}
          {!editing && <AssistantLauncher className="mb-4 md:hidden" />}

          {/* A phone has no page header to hang "Done" off, so arranging says
              so for itself. */}
          {editing && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] px-3 py-2.5 md:hidden">
              <p className="text-xs text-muted-foreground">
                Hold a widget's handle to move it.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={isDefaultLayout(layout)}
                className="shrink-0 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          )}

          <DashboardGrid
            visible={visible}
            hidden={hidden}
            ctx={ctx}
            editing={editing}
            onMove={move}
            onResize={resize}
            onHide={hide}
            onShow={show}
          />
        </>
      )}
    </PageShell>
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
        to={ROUTES.contactsOverdue}
        value={stats.overdueCount}
        label="overdue"
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
