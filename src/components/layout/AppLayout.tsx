import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Tag as TagIcon,
  Settings,
  Search,
  Plus,
  Mic,
  KanbanSquare,
  Mail,
  GraduationCap,
  CalendarDays,
  QrCode,
  MoreHorizontal,
  Sparkles,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from './ThemeToggle'
import { MoreSheet } from './MoreSheet'
import { ShareProfileDialog } from '@/components/profile/ShareProfileDialog'
import { ExtensionBanner } from '@/components/layout/ExtensionBanner'
import { useUI } from '@/context/ui-context'
import { useAuth } from '@/auth/AuthProvider'
import { useAutoLogMeetings } from '@/hooks/useAutoLogMeetings'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { displayName, initialFor } from '@/lib/displayName'

const PRIMARY_NAV = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: ROUTES.contacts, label: 'Contacts', icon: Users, end: false },
  { to: ROUTES.college, label: 'College', icon: GraduationCap, end: false },
  { to: ROUTES.pipeline, label: 'Pipeline', icon: KanbanSquare, end: false },
]

/**
 * The phone's tab bar. Two destinations either side of the assistant, and
 * everything else behind More — a five-across nav on a 375px screen gives
 * every item a tap target too small to hit.
 */
const TAB_NAV = [
  { to: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard, end: true },
  { to: ROUTES.contacts, label: 'Contacts', icon: Users, end: false },
  { to: ROUTES.calendar, label: 'Calendar', icon: CalendarDays, end: false },
]

const SECONDARY_NAV = [
  { to: ROUTES.calendar, label: 'Calendar', icon: CalendarDays, end: false },
  { to: ROUTES.templates, label: 'Templates', icon: Mail, end: false },
  { to: ROUTES.tags, label: 'Tags', icon: TagIcon, end: false },
  { to: ROUTES.settings, label: 'Settings', icon: Settings, end: false },
]

/**
 * One tab. 49pt tall with a 25pt glyph and a 10pt label — the proportions a
 * UITabBar uses, which is most of why one reads as native and a row of
 * web buttons doesn't. Selection is shown by tint and weight, never by a pill
 * or a background.
 */
function TabItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: typeof Users
  end: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'press flex h-[49px] flex-1 flex-col items-center justify-center gap-[3px]',
          isActive ? 'text-indigo-500' : 'text-muted-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[25px] w-[25px]" strokeWidth={isActive ? 2.4 : 1.8} />
          <span className="text-[10px] font-medium leading-none tracking-[-0.01em]">
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
        <Users className="h-4 w-4" />
      </div>
      <span className="text-lg font-semibold tracking-tight">Retrn</span>
    </div>
  )
}

function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            {initialFor(user)}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {displayName(user)}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(ROUTES.settings)}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  )
}

/**
 * App shell. This owns exactly two things that must never scroll: the
 * sidebar and the phone's tab bar. Everything else — including the phone's
 * navigation bar, which belongs to the screen and not to the app — is each
 * page's own responsibility (see PageShell).
 *
 * Note what the phone deliberately does *not* have: an app-level top bar. A
 * global chrome bar stacked above a per-screen header is a website's anatomy;
 * an iPhone app gives each screen a single navigation bar and puts the app's
 * identity in the icon on the home screen.
 */
export function AppLayout() {
  const { openNewContact, openVoiceCapture, openSearch, openAssistant } = useUI()
  const [shareOpen, setShareOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)

  // Past meetings roll into the linked contacts' timelines automatically.
  useAutoLogMeetings()

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop sidebar — fixed, never scrolls */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-hidden border-r bg-card/40 md:flex">
        <div className="px-5 pt-4">
          <Logo />
        </div>

        <div className="mt-5 space-y-2 px-3">
          <div className="flex gap-2">
            <Button
              className="flex-1 justify-start gap-2"
              onClick={openVoiceCapture}
            >
              <Mic className="h-4 w-4" />
              Say who you met
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={openNewContact}
              aria-label="New contact (form)"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <button
            onClick={openSearch}
            className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          <button
            onClick={() => openAssistant()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
            <span className="flex-1 text-left">Assistant</span>
          </button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 px-3">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Toolkit
          </div>
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t px-3 py-3">
          <button
            onClick={() => setShareOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
          >
            <QrCode className="h-4 w-4" />
            Share profile
          </button>
          <AccountMenu />
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] text-muted-foreground">Synced to the cloud</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Page outlet — a fixed-height box; each page owns its own navigation
            bar (pinned) + scrollable body split via PageShell. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>

        {/* Phone tab bar — fixed, never scrolls. The assistant sits in the
            middle: on a phone it is the fastest way both to find someone and
            to record what just happened, so it gets the thumb's natural
            resting spot rather than a menu item. */}
        <nav className="chrome material-bar hairline-t flex shrink-0 items-stretch pb-[env(safe-area-inset-bottom)] md:hidden">
          {TAB_NAV.slice(0, 2).map((item) => (
            <TabItem key={item.to} {...item} />
          ))}

          {/* Kept inside the bar rather than raised above it: the content
              column clips its overflow, so a button poking over the top edge
              would be cut in half. */}
          <button
            type="button"
            onClick={() => openAssistant()}
            aria-label="Open the assistant"
            className="press flex h-[49px] flex-1 flex-col items-center justify-center gap-[3px]"
          >
            <span className="flex h-[27px] w-[27px] items-center justify-center rounded-full bg-indigo-500 text-white">
              <Sparkles className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="text-[10px] font-medium leading-none tracking-[-0.01em] text-indigo-500">
              Assistant
            </span>
          </button>

          {TAB_NAV.slice(2).map((item) => (
            <TabItem key={item.to} {...item} />
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className="press flex h-[49px] flex-1 flex-col items-center justify-center gap-[3px] text-muted-foreground"
          >
            <MoreHorizontal className="h-[25px] w-[25px]" strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-none tracking-[-0.01em]">
              More
            </span>
          </button>
        </nav>
      </div>

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        onShareProfile={() => setShareOpen(true)}
      />
      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
      <ExtensionBanner />
    </div>
  )
}
