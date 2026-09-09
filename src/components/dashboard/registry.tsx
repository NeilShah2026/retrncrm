import {
  AlarmClock,
  CalendarClock,
  CalendarDays,
  Gauge,
  KanbanSquare,
  Sparkles,
  Tags,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { BriefingCard } from '@/components/dashboard/BriefingCard'
import { NeedsAttention } from '@/components/dashboard/NeedsAttention'
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings'
import { NetworkMix } from '@/components/dashboard/widgets/NetworkMix'
import { PipelineSnapshot } from '@/components/dashboard/widgets/PipelineSnapshot'
import { QuickActions } from '@/components/dashboard/widgets/QuickActions'
import { RecentlyAdded } from '@/components/dashboard/widgets/RecentlyAdded'
import { StatTile } from '@/components/dashboard/widgets/StatTile'
import { TopTags } from '@/components/dashboard/widgets/TopTags'
import { ROUTES } from '@/lib/routes'
import type { WidgetId } from '@/lib/dashboardLayout'
import type { DashboardStats } from '@/lib/dashboardStats'
import type { CalendarEvent, Contact, Opportunity, Tag } from '@/types'

/** Everything a widget might need, gathered once by the page. */
export interface WidgetContext {
  contacts: Contact[]
  opportunities: Opportunity[]
  events: CalendarEvent[]
  contactMap: Map<string, Contact>
  tagMap: Map<string, Tag>
  tags: Tag[]
  stats: DashboardStats
  /** False while the slower lists are still arriving. */
  ready: boolean
}

export interface WidgetMeta {
  /** Shown on the customise chrome and in the "add a widget" tray. */
  title: string
  /** One line, for the tray — why you'd want this on your home screen. */
  description: string
  icon: typeof Users
  render: (ctx: WidgetContext) => React.ReactNode
}

/**
 * The catalog. An id in a saved layout means nothing on its own; this is where
 * it becomes a card. Adding a widget to the app is adding an entry here and an
 * id (with its default size) to `DEFAULT_LAYOUT` — existing dashboards pick it
 * up in the tray without being rearranged.
 */
export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  'stat-contacts': {
    title: 'Total contacts',
    description: 'Everyone in your network, counted.',
    icon: Users,
    render: (ctx) => (
      <StatTile
        icon={Users}
        label="Total contacts"
        value={ctx.stats.total}
        accent="text-indigo-500"
        to={ROUTES.contacts}
      />
    ),
  },
  'stat-meetings': {
    title: 'Meetings this week',
    description: 'What the next seven days hold.',
    icon: CalendarClock,
    render: (ctx) => (
      <StatTile
        icon={CalendarClock}
        label="Meetings this week"
        value={ctx.stats.meetingsThisWeek}
        accent="text-sky-500"
        to={ROUTES.calendar}
      />
    ),
  },
  'stat-overdue': {
    title: 'Overdue',
    description: 'People past the cadence you set for them.',
    icon: AlarmClock,
    render: (ctx) => (
      <StatTile
        icon={AlarmClock}
        label="Overdue"
        value={ctx.stats.overdueCount}
        accent="text-amber-500"
        to={ROUTES.contactsOverdue}
      />
    ),
  },
  'stat-pipeline': {
    title: 'Open applications',
    description: 'Everything on the board that hasn’t closed.',
    icon: KanbanSquare,
    render: (ctx) => (
      <StatTile
        icon={KanbanSquare}
        label="Open applications"
        value={ctx.stats.openOpportunities}
        accent="text-violet-500"
        to={ROUTES.pipeline}
      />
    ),
  },
  'stat-added-this-month': {
    title: 'Added this month',
    description: 'Whether you’re actually meeting people.',
    icon: UserPlus,
    render: (ctx) => (
      <StatTile
        icon={UserPlus}
        label="Added this month"
        value={ctx.stats.addedThisMonth}
        accent="text-emerald-500"
        to={ROUTES.contacts}
      />
    ),
  },
  'stat-strong-ties': {
    title: 'Strong ties',
    description: 'The people you’d actually ask for something.',
    icon: Gauge,
    render: (ctx) => (
      <StatTile
        icon={Gauge}
        label="Strong ties"
        value={ctx.stats.strongTies}
        accent="text-rose-500"
        to={ROUTES.contacts}
      />
    ),
  },
  briefing: {
    title: 'Your briefing',
    description: 'What to do now, ordered, with the reason why.',
    icon: Sparkles,
    render: (ctx) => (
      <BriefingCard
        contacts={ctx.contacts}
        opportunities={ctx.opportunities}
        events={ctx.events}
        tagMap={ctx.tagMap}
        ready={ctx.ready}
      />
    ),
  },
  'upcoming-meetings': {
    title: 'Upcoming meetings',
    description: 'Who you’re seeing next, and when.',
    icon: CalendarDays,
    render: (ctx) => (
      <UpcomingMeetings events={ctx.events} contactMap={ctx.contactMap} />
    ),
  },
  'needs-attention': {
    title: 'Needs a nudge',
    description: 'The people who have waited longest to hear from you.',
    icon: AlarmClock,
    render: (ctx) => <NeedsAttention contacts={ctx.contacts} />,
  },
  'recently-added': {
    title: 'Recently added',
    description: 'The last few people you saved.',
    icon: Sparkles,
    render: (ctx) => <RecentlyAdded contacts={ctx.contacts} />,
  },
  'pipeline-snapshot': {
    title: 'Recruiting pipeline',
    description: 'Stage counts and the deadlines coming up.',
    icon: KanbanSquare,
    render: (ctx) => <PipelineSnapshot opportunities={ctx.opportunities} />,
  },
  'quick-actions': {
    title: 'Quick actions',
    description: 'Capture, ask, search and schedule, in one grid.',
    icon: Zap,
    render: () => <QuickActions />,
  },
  'top-tags': {
    title: 'Top tags',
    description: 'Which corners of your network are actually big.',
    icon: Tags,
    render: (ctx) => <TopTags contacts={ctx.contacts} tags={ctx.tags} />,
  },
  'network-mix': {
    title: 'Network mix',
    description: 'How close your network is, by relationship strength.',
    icon: Gauge,
    render: (ctx) => <NetworkMix contacts={ctx.contacts} />,
  },
}
