import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Tag as TagIcon,
  Settings,
  Search,
  Plus,
  PenLine,
  KanbanSquare,
  Mail,
  GraduationCap,
  CalendarDays,
  QrCode,
  MoreHorizontal,
  MessageSquare,
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
  { to: ROUTES.assistant, label: 'Assistant', icon: MessageSquare, end: false },
]

/** The phone's tab bar: four destinations plus More. */
const TAB_NAV = [
  { to: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard, end: true },
  { to: ROUTES.contacts, label: 'Contacts', icon: Users, end: false },
  { to: ROUTES.assistant, label: 'Assistant', icon: MessageSquare, end: false },
  { to: ROUTES.calendar, label: 'Calendar', icon: CalendarDays, end: false },
]

const SECONDARY_NAV = [
  { to: ROUTES.calendar, label: 'Calendar', icon: CalendarDays, end: false },
  { to: ROUTES.templates, label: 'Templates', icon: Mail, end: false },
  { to: ROUTES.tags, label: 'Tags', icon: TagIcon, end: false },
  { to: ROUTES.settings, label: 'Settings', icon: Settings, end: false },
]

/**
 * One tab. 49pt tall with a 25pt glyph and a 10pt label — UITabBar
 * proportions. Selection is shown by tint and weight, never by a pill.
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
          isActive ? 'text-brand' : 'text-muted-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[25px] w-[25px]" strokeWidth={isActive ? 2.2 : 1.8} />
          <span className="text-[10px] font-medium leading-none tracking-[-0.01em]">
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

/** The wordmark. A neutral mark — the brand is the type, not a tile. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <span className="text-[13px] font-semibold leading-none">R</span>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Retrn</span>
    </div>
  )
}

function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-sunken text-[10px] font-semibold text-text-secondary">
            {initialFor(user)}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {displayName(user)}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(ROUTES.settings)}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Sidebar row: 32px, selected = brand text on a sunken tint. */
function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
    isActive
      ? 'bg-accent font-medium text-foreground [&_svg]:text-brand'
      : 'text-text-secondary hover:bg-accent/70 hover:text-foreground',
  )
}

/**
 * App shell. Owns exactly two things that never scroll: the sidebar and the
 * phone's tab bar. Each page owns its own header + scroll region (PageShell).
 */
export function AppLayout() {
  const { openNewContact, openVoiceCapture, openSearch } = useUI()
  const [shareOpen, setShareOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)

  useAutoLogMeetings()

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col overflow-hidden border-r bg-bg-sunken/50 md:flex">
        <div className="flex h-12 items-center px-4">
          <Logo />
        </div>

        <div className="space-y-1.5 px-3 pt-1">
          <div className="flex gap-1.5">
            <Button className="flex-1 justify-start" onClick={openVoiceCapture}>
              <PenLine />
              Say who you met
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={openNewContact}
              aria-label="New contact (form)"
              title="New contact (N)"
            >
              <Plus />
            </Button>
          </div>
          <button
            onClick={openSearch}
            className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2 text-sm text-muted-foreground transition-colors duration-fast hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search or run…</span>
            <kbd className="pointer-events-none rounded-sm border bg-bg-sunken px-1 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-px px-3">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4 text-muted-foreground" />
              {item.label}
            </NavLink>
          ))}
          <div className="text-label px-2 pb-1 pt-4 text-muted-foreground">Toolkit</div>
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4 text-muted-foreground" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t px-3 py-2">
          <button
            onClick={() => setShareOpen(true)}
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-text-secondary transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <QrCode className="h-4 w-4 text-muted-foreground" />
            Share profile
          </button>
          <AccountMenu />
          <div className="flex items-center justify-between px-2 pt-0.5">
            <span className="text-xs text-muted-foreground">Synced</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>

        {/* Phone tab bar */}
        <nav className="chrome material-bar hairline-t flex shrink-0 items-stretch pb-[env(safe-area-inset-bottom)] md:hidden">
          {TAB_NAV.map((item) => (
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
