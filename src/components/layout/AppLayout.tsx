import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
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
import { Logo } from './Logo'
import { ShareProfileDialog } from '@/components/profile/ShareProfileDialog'
import { ExtensionBanner } from '@/components/layout/ExtensionBanner'
import { BillingNotice } from '@/components/billing/BillingNotice'
import { useUI } from '@/context/ui-context'
import { useAuth } from '@/auth/AuthProvider'
import { useAutoLogMeetings } from '@/hooks/useAutoLogMeetings'
import { useReminderSync } from '@/hooks/useReminderSync'
import { useInbox } from '@/lib/inbox'
import { selectionFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { displayName, initialFor } from '@/lib/displayName'

export { Logo }

const PRIMARY_NAV = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: ROUTES.inbox, label: 'Inbox', icon: Inbox, end: false },
  { to: ROUTES.contacts, label: 'Contacts', icon: Users, end: false },
  { to: ROUTES.college, label: 'College', icon: GraduationCap, end: false },
  { to: ROUTES.pipeline, label: 'Pipeline', icon: KanbanSquare, end: false },
  { to: ROUTES.assistant, label: 'Assistant', icon: MessageSquare, end: false },
]

/** The phone's tab bar: five destinations plus More, which is a screen too. */
const TAB_NAV = [
  { to: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard, end: true },
  { to: ROUTES.inbox, label: 'Inbox', icon: Inbox, end: false },
  { to: ROUTES.contacts, label: 'Contacts', icon: Users, end: false },
  { to: ROUTES.assistant, label: 'Assistant', icon: MessageSquare, end: false },
  { to: ROUTES.calendar, label: 'Calendar', icon: CalendarDays, end: false },
  { to: ROUTES.more, label: 'More', icon: MoreHorizontal, end: false },
]

const SECONDARY_NAV = [
  { to: ROUTES.calendar, label: 'Calendar', icon: CalendarDays, end: false },
  { to: ROUTES.templates, label: 'Templates', icon: Mail, end: false },
  { to: ROUTES.tags, label: 'Tags', icon: TagIcon, end: false },
  { to: ROUTES.settings, label: 'Settings', icon: Settings, end: false },
]

// 4px grid (DESIGN.md §4): 12 + 24 glyph + 12 = a 48pt item, inside the
// bar's own 4px padding = a 56px bar. No caption — the glyph carries it, and
// each tab keeps an aria-label so it is still named for assistive tech.
const TAB_ITEM_CLASS =
  'relative flex flex-1 items-center justify-center rounded-full py-3'

const TAB_SLOTS = TAB_NAV.length

/** One tab. A 23pt glyph over a 10pt label. */
function TabItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string
  label: string
  icon: typeof Users
  end: boolean
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={selectionFeedback}
      aria-label={label}
      className={({ isActive }) =>
        cn(TAB_ITEM_CLASS, isActive ? 'text-brand' : 'press text-muted-foreground')
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="relative h-6 w-6" strokeWidth={isActive ? 2.4 : 1.9} />
          {Boolean(badge) && (
            <span
              aria-hidden
              className="absolute right-[calc(50%-15px)] top-2 h-2 w-2 rounded-full bg-danger"
            />
          )}
        </>
      )}
    </NavLink>
  )
}

/**
 * The phone's tab bar: a floating glass capsule the content scrolls beneath.
 * Selection is a single tinted pill that *slides* between slots rather than
 * appearing under the new one — the one piece of motion that tells you the
 * bar is one control rather than five buttons standing next to each other.
 * It is one positioned element and a transform, deliberately: a layout
 * animation library would have cost more to download than the whole rest of
 * this bar weighs.
 */
function PhoneTabBar() {
  const { pathname } = useLocation()
  const { count } = useInbox()
  const activeIndex = TAB_NAV.findIndex((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )

  return (
    <nav
      className={cn(
        'chrome pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden',
        // Sits close to the bottom edge, the way iOS 26 floats a tab bar —
        // the home indicator's full inset would leave it stranded up the
        // screen, but it still clears the indicator itself. The token is
        // shared with `--tab-bar-inset`, the room pages leave below content.
        'pb-[var(--tab-bar-offset)]',
        // Out of the way while someone is typing, as in Messages — driven by
        // CSS on the keyboard's own clock, so it leaves as the keyboard
        // arrives rather than a render later.
        'hide-for-keyboard',
      )}
    >
      {/* A capsule, per DESIGN.md's `pill: full` — not an arbitrary radius. */}
      <div className="glass glass-floating pointer-events-auto relative flex w-full max-w-[336px] items-stretch rounded-full p-1">
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-1 left-1 rounded-full bg-brand/10',
            'transition-[transform,opacity] duration-300 ease-[var(--ease-spring)]',
            activeIndex < 0 && 'opacity-0',
          )}
          style={{
            width: `calc((100% - 0.5rem) / ${TAB_SLOTS})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />

        {TAB_NAV.map((item) => (
          <TabItem key={item.to} {...item} badge={item.to === ROUTES.inbox ? count : undefined} />
        ))}
      </div>
    </nav>
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
  const { count: inboxCount } = useInbox()
  const [shareOpen, setShareOpen] = React.useState(false)

  useAutoLogMeetings()
  useReminderSync()

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
              <span className="flex-1">{item.label}</span>
              {item.to === ROUTES.inbox && inboxCount > 0 && (
                <span className="tnum rounded-full bg-bg-sunken px-1.5 text-xs font-medium text-text-secondary">
                  {inboxCount}
                </span>
              )}
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
        {/* A card that failed, or a subscription running out: above every
            page, because it is about to change what the app can do. */}
        <BillingNotice />
        {/* Gives up its bottom edge to the keyboard as the keyboard rises,
            so every page shrinks with it instead of being covered. */}
        <main className="keyboard-inset flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>

        {/* Floats over the content it scrolls above rather than sitting in a
            strip below it — pages leave room with `pb-tab-bar` (PageShell). */}
        <PhoneTabBar />
      </div>

      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
      <ExtensionBanner />
    </div>
  )
}
