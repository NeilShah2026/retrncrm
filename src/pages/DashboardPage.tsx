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
      // The home tab is the one screen with no title. "Dashboard" only ever
      // named the tab you had just tapped, and a phone has no room to spend on
      // a word that tells you nothing — so the bar carries the app's mark and
      // the two things you do standing up, and the content starts at the top.
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
              <Mic />
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
 * The app's mark, sized for a navigation bar. This is the only screen that
 * shows it: on a phone the app's identity lives on the home screen icon, so
 * repeating it on every screen would just be a website's masthead.
 */
function MobileBrand() {
  return (
    <div className="flex items-center gap-1.5 pl-0.5">
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-indigo-500 text-white">
        <Users className="h-3.5 w-3.5" />
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em]">Retrn</span>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <PageShell
      mobile={{ leading: <MobileBrand /> }}
      header={<PageHeader title="Dashboard" description="Loading your network…" />}
    >
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
